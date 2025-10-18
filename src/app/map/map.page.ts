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
  currentMarker?: L.Marker;
  barangayPolygons: Record<string, L.Polygon> = {};

  private POLYGONS: Record<string, [number, number][]> = {
    'Carig Sur': [
      [17.66301947673273, 121.73118056780248],
      [17.650777604730315, 121.7363049725038],
      [17.648095285699988, 121.74142937724469],
      [17.646994835565994, 121.7474198785615],
      [17.647613839593724, 121.75781303747257],
      [17.64630705081782, 121.76113307434694],
      [17.65634844734729, 121.76726792509308],
      [17.662056662792782, 121.7737636494125],
      [17.671068730302334, 121.75253549600292],
    ],
    'Carig Norte': [
      [17.671624175550466, 121.75279319559237],
      [17.672237528276824, 121.74996078301383],
      [17.67332111298083, 121.74805105029046],
      [17.671787736482027, 121.74712837043535],
      [17.681661811641, 121.73468332259671],
      [17.68650365860692, 121.741034546962],
      [17.685115906896026, 121.74414498449481],
      [17.685313, 121.757698],
      [17.683964, 121.765294],
      [17.685068, 121.772676],
      [17.684542, 121.779993],
      [17.664244, 121.770551],
    ],
    'Linao East': [
      [17.653743857017393, 121.73299772466706],
      [17.649092512763534, 121.71937432688945],
      [17.645146066156926, 121.72080126212546],
      [17.6462195899607, 121.7286011259559],
      [17.646833029272294, 121.7316266578886],
      [17.65229853844148, 121.73136629557996],
      [17.65253368248669, 121.73312582478904],
    ],
    'Linao West': [
      [17.648167710601882, 121.7070070603481],
      [17.66948759569577, 121.71155406737171],
      [17.653029482477105, 121.72105254734704],
      [17.64898010205808, 121.71935316957513],
      [17.648167710601882, 121.7070070603481],
    ],
    'Linao Norte': [
      [17.653767069733973, 121.73300244317701],
      [17.677981484640267, 121.72552487289595],
      [17.66942999982645, 121.7115730269331],
      [17.653057626072606, 121.7210653878961],
    ],
  };

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
        zoom: 14,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(this.map);

      const userMarker = L.marker([lat, lng]).addTo(this.map);
      userMarker.bindPopup('You are here').openPopup();

      // Draw barangay polygons
      Object.entries(this.POLYGONS).forEach(([name, coords]) => {
        const polygon = L.polygon(coords as L.LatLngExpression[], {
          color: '#3CB371',
          weight: 2,
          dashArray: '8 6',
          fillColor: '#90EE90',
          fillOpacity: 0.25,
        }).addTo(this.map);
        this.barangayPolygons[name] = polygon;
      });

      // Load and cluster verified reports
      await this.kMeansService.loadVerifiedReports();
      const clusteredData = this.kMeansService.getClusteredData();

      const clusterGroups: Record<number, ClusteredPoint[]> = {};
      clusteredData.forEach((point) => {
        if (!clusterGroups[point.cluster]) clusterGroups[point.cluster] = [];
        clusterGroups[point.cluster].push(point);
      });

      Object.entries(clusterGroups).forEach(([clusterId, points]) => {
        const first = points[0];
        const color = first.color;
        const total = points.length;
        const categories = Array.from(new Set(points.map((p) => p.category))).join(', ');
        const mostRecent = this.getMostRecentDate(points);

        const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / total;
        const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / total;

        const distances = points.map((p) => this.getDistanceMeters(p.lat, p.lng, avgLat, avgLng));
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const radius = Math.min(Math.max(avgDistance * 2, 50), 300);

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

      // Click event for adding reports
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        const clickedLat = e.latlng.lat;
        const clickedLng = e.latlng.lng;
        const barangay = this.getBarangayForLocation(clickedLat, clickedLng);

        if (this.currentMarker) {
          this.map.removeLayer(this.currentMarker);
        }

        let popupContent = '';
        if (barangay) {
          popupContent = `
            <b>Add Report</b><br>
            <small>Barangay: ${barangay}</small><br>
            <button id="addReportBtn" style="
              margin-top:6px;
              background-color:#E1A96C;
              color:#1B3333;
              border:none;
              border-radius:8px;
              padding:5px 10px;
              font-weight:600;
              cursor:pointer;
            ">Add Report</button>
          `;
        } else {
          popupContent = `
            <b>Outside Barangay Area</b><br>
            <small>Reporting is only allowed within specified barangays.</small>
          `;
        }

        this.currentMarker = L.marker([clickedLat, clickedLng])
          .addTo(this.map)
          .bindPopup(popupContent)
          .openPopup();

        if (barangay) {
          setTimeout(() => {
            const btn = document.getElementById('addReportBtn');
            if (btn) {
              btn.addEventListener('click', () => {
                this.goToAddReport(clickedLat, clickedLng, barangay);
              });
            }
          }, 300);
        }
      });
    } catch (error) {
      console.error('Error loading map:', error);
      alert('Could not get your location. Please enable GPS.');
    }
  }

  getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
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
      .map((p) => (p.date ? new Date(p.date) : null))
      .filter((d) => d !== null) as Date[];
    if (!dates.length) return 'Unknown';
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    return latest.toLocaleDateString();
  }

  getRiskLabel(color: string): string {
    switch (color) {
      case '#FFFF00':
        return 'Low';
      case '#FFA500':
        return 'Medium';
      case '#FF0000':
        return 'High';
      default:
        return 'Unknown';
    }
  }

  getBarangayForLocation(lat: number, lng: number): string | null {
    const point = L.latLng(lat, lng);
    for (const [name, polygon] of Object.entries(this.barangayPolygons)) {
      if (polygon.getBounds().contains(point) && this.pointInPolygon(point, polygon)) {
        return name;
      }
    }
    return null;
  }

  pointInPolygon(point: L.LatLng, polygon: L.Polygon): boolean {
    const polyPoints = polygon.getLatLngs()[0] as L.LatLng[];
    let inside = false;
    for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
      const xi = polyPoints[i].lat, yi = polyPoints[i].lng;
      const xj = polyPoints[j].lat, yj = polyPoints[j].lng;
      const intersect =
        yi > point.lng !== yj > point.lng &&
        point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  goToAddReport(lat: number, lng: number, barangay: string) {
    this.navCtrl.navigateForward(['/add-incident'], {
      queryParams: { lat, lng, barangay },
    });
  }

  goBack() {
    this.navCtrl.back();
  }
}
