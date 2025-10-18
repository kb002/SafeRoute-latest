import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';

export interface Incident {
  lat: number;
  lng: number;
  category?: string;
  status?: string;
  date?: string;
}

export interface ClusteredPoint extends Incident {
  cluster: number;
  color: string;
  riskScore: number;
}

@Injectable({
  providedIn: 'root',
})
export class KMeansService {
  private data: Incident[] = [];
  private cachedClusters: ClusteredPoint[] = [];
  private lastDataHash = '';

  private colors = ['#FFFF00', '#FFA500', '#FF0000']; // Yellow, Orange, Red
  private BASE_DISTANCE_METERS = 100; // proximity threshold for separate clusters
  private EARTH_RADIUS = 6371e3;

  private categoryRisk: Record<string, number> = {
    Theft: 0.8,
    Assault: 1.0,
    'Car Accident': 0.7,
    Flood: 0.6,
    'Blocked Lane': 0.4,
  };

  constructor(private firestore: Firestore) {}

  async loadVerifiedReports() {
    const reportsRef = collection(this.firestore, 'reports');
    const q = query(reportsRef, where('status', '==', 'verified'));
    const snapshot = await getDocs(q);

    const verifiedReports: Incident[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          lat: data['lat'],
          lng: data['lng'],
          category: data['category'],
          status: data['status'],
          date: data['datetime'] || data['date'],
        } as Incident;
      })
      .filter(
        (r) => r.lat && r.lng && r.category && this.categoryRisk[r.category]
      );

    this.setData(verifiedReports);
  }

  setData(data: Incident[]) {
    this.data = data.filter(
      (d) => d.category && Object.keys(this.categoryRisk).includes(d.category)
    );
  }

  getClusteredData(): ClusteredPoint[] {
    const hash = JSON.stringify(this.data);
    if (hash === this.lastDataHash) return this.cachedClusters;
    this.lastDataHash = hash;
    if (this.data.length === 0) return [];

    // Step 1: Pre-merge nearby points (< BASE_DISTANCE_METERS)
    const mergedPoints = this.mergeNearbyPoints(this.data, this.BASE_DISTANCE_METERS);

    // Step 2: Adaptive K: each merged point becomes a separate cluster initially
    const estimatedK = mergedPoints.length;

    // Step 3: K-Means++ initialization
    let centroids = this.initCentroidsKMeansPP(mergedPoints, estimatedK);

    let assignments = new Array(this.data.length).fill(0);
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 50) {
      changed = false;
      iterations++;

      // Assign each point to nearest centroid
      for (let i = 0; i < this.data.length; i++) {
        const distances = centroids.map((c) =>
          this.getDistanceMeters(this.data[i].lat, this.data[i].lng, c.lat, c.lng)
        );
        const clusterIndex = distances.indexOf(Math.min(...distances));
        if (assignments[i] !== clusterIndex) {
          assignments[i] = clusterIndex;
          changed = true;
        }
      }

      // Update centroids
      for (let j = 0; j < estimatedK; j++) {
        const clusterPoints = this.data.filter((_, idx) => assignments[idx] === j);
        if (clusterPoints.length > 0) {
          const avgLat = clusterPoints.reduce((sum, p) => sum + p.lat, 0) / clusterPoints.length;
          const avgLng = clusterPoints.reduce((sum, p) => sum + p.lng, 0) / clusterPoints.length;
          centroids[j] = { lat: avgLat, lng: avgLng };
        }
      }
    }

    // Step 4: Risk scoring per cluster
    const clusterScores = Array(estimatedK).fill(0);
    const now = new Date();

    for (let j = 0; j < estimatedK; j++) {
      const clusterPoints = this.data.filter((_, idx) => assignments[idx] === j);
      let totalScore = 0;

      clusterPoints.forEach((p) => {
        const categoryScore = this.categoryRisk[p.category!] || 0.5;
        const daysOld = p.date
          ? (now.getTime() - new Date(p.date).getTime()) / (1000 * 3600 * 24)
          : 30;
        const recencyScore = Math.max(0, 1 - daysOld / 30);
        totalScore += 0.6 * categoryScore + 0.4 * recencyScore;
      });

      clusterScores[j] = clusterPoints.length > 0 ? totalScore / clusterPoints.length : 0;
    }

    const maxRisk = Math.max(...clusterScores);
    const minRisk = Math.min(...clusterScores);

    // Step 5: Assign color based on normalized risk score
    const clusteredData: ClusteredPoint[] = this.data.map((point, idx) => {
      const clusterIndex = assignments[idx];
      const clusterRisk = clusterScores[clusterIndex];
      const ratio = (clusterRisk - minRisk) / (maxRisk - minRisk + 0.0001);

      let color = '#FFFF00'; // Low
      if (ratio > 0.66) color = '#FF0000'; // High
      else if (ratio > 0.33) color = '#FFA500'; // Medium

      return {
        ...point,
        cluster: clusterIndex,
        color,
        riskScore: clusterRisk,
      };
    });

    this.cachedClusters = clusteredData;
    return clusteredData;
  }

  /** Pre-merge nearby points (< threshold) */
  private mergeNearbyPoints(data: Incident[], threshold: number): Incident[] {
    const merged: Incident[] = [];
    const visited = new Set<number>();

    for (let i = 0; i < data.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);

      const closePoints = [data[i]];
      for (let j = i + 1; j < data.length; j++) {
        if (visited.has(j)) continue;
        const d = this.getDistanceMeters(data[i].lat, data[i].lng, data[j].lat, data[j].lng);
        if (d <= threshold) {
          visited.add(j);
          closePoints.push(data[j]);
        }
      }

      const avgLat = closePoints.reduce((sum, p) => sum + p.lat, 0) / closePoints.length;
      const avgLng = closePoints.reduce((sum, p) => sum + p.lng, 0) / closePoints.length;
      merged.push({ lat: avgLat, lng: avgLng });
    }

    return merged;
  }

  /** K-Means++ centroid initialization */
  private initCentroidsKMeansPP(data: Incident[], k: number) {
    const centroids: Incident[] = [];
    centroids.push(data[Math.floor(Math.random() * data.length)]);

    while (centroids.length < k) {
      const distances = data.map((p) =>
        Math.min(...centroids.map((c) => this.getDistanceMeters(p.lat, p.lng, c.lat, c.lng)))
      );
      const maxDistIndex = distances.indexOf(Math.max(...distances));
      centroids.push(data[maxDistIndex]);
    }
    return centroids;
  }

  /** Haversine distance in meters */
  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS * c;
  }
}
