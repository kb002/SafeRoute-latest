import { Component, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
import { Geolocation } from '@awesome-cordova-plugins/geolocation/ngx';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { BottomNavComponent } from '../components/bottom-nav/bottom-nav.component';
import { KMeansService, Incident, ClusteredPoint } from '../services/kmeans.service';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const iconRetinaUrl = 'assets/leaflet/marker-icon.png';
const iconUrl = 'assets/leaflet/marker-icon.png';
const shadowUrl = 'assets/leaflet/marker-shadow.png';

const defaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, BottomNavComponent],
})
export class MapPage implements AfterViewInit {
  map!: L.Map;

  constructor(
    private geolocation: Geolocation,
    private navCtrl: NavController,
    private kMeansService: KMeansService
  ) {}

  async ngAfterViewInit() {
    await this.loadMap();
  }

  async loadMap() {
    try {
      const position = await this.geolocation.getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      this.map = L.map('map', {
        center: [lat, lng],
        zoom: 15,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(this.map);

      const userMarker = L.marker([lat, lng]).addTo(this.map);
      userMarker.bindPopup('You are here').openPopup();

      // ✅ Fetch verified reports (fallback to mock data)
      const firestore = getFirestore();
      const q = query(collection(firestore, 'reports'), where('status', '==', 'verified'));
      const snapshot = await getDocs(q);
      const reports: Incident[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          lat: data['lat'],
          lng: data['lng'],
          category: data['category'],
          date: data['datetime'] || data['date'],
        };
      });

      this.kMeansService.setData(reports);
      const clusteredData = this.kMeansService.getClusteredData(3);

      // ✅ Group points by cluster
      const clusterGroups: Record<number, ClusteredPoint[]> = {};
      clusteredData.forEach(point => {
        if (!clusterGroups[point.cluster]) clusterGroups[point.cluster] = [];
        clusterGroups[point.cluster].push(point);
      });

      // ✅ Draw danger zones (dynamic radius)
      Object.entries(clusterGroups).forEach(([clusterId, points]) => {
        const first = points[0];
        const color = first.color;
        const total = points.length;
        const categories = Array.from(new Set(points.map(p => p.category))).join(', ');
        const mostRecent = this.getMostRecentDate(points);

        // Compute cluster center
        const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / total;
        const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / total;

        // ✅ Compute average distance between points in cluster
        const distances = points.map(p => this.getDistanceMeters(p.lat, p.lng, avgLat, avgLng));
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

        // ✅ Radius = cluster spread (minimum 50m, maximum 300m)
        const radius = Math.min(Math.max(avgDistance * 2, 50), 300);

        // Draw circle
        L.circle([avgLat, avgLng], {
          color,
          fillColor: color,
          fillOpacity: 0.5,
          radius,
        })
          .addTo(this.map)
          .bindPopup(
            `<b>Risk Level:</b> ${this.getRiskLabel(color)}<br>
             <b>Total Incidents:</b> ${total}<br>
             <b>Categories:</b> ${categories || 'N/A'}<br>
             <b>Most Recent:</b> ${mostRecent}<br>
             <b>Approx. Coverage:</b> ${radius.toFixed(0)}m`
          );
      });

    } catch (error) {
      console.error('Error loading map:', error);
      alert('Could not get your location. Please enable GPS.');
    }
  }

  // ✅ Helper: Convert lat/lng distance to meters
  getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  getMostRecentDate(points: Incident[]): string {
    const dates = points
      .map(p => (p.date ? new Date(p.date) : null))
      .filter(d => d !== null) as Date[];
    if (!dates.length) return 'Unknown';
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    return latest.toLocaleDateString();
  }

  getRiskLabel(color: string): string {
    switch (color) {
      case '#FFFF00': return 'Low';
      case '#FFA500': return 'Medium';
      case '#FF0000': return 'High';
      default: return 'Unknown';
    }
  }

  goBack() {
    this.navCtrl.back();
  }
}
