import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Geolocation } from '@awesome-cordova-plugins/geolocation/ngx';
import * as L from 'leaflet';

@Component({
  selector: 'app-add-incident',
  templateUrl: './add-incident.page.html',
  styleUrls: ['./add-incident.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class AddIncidentPage implements OnInit {
  categories = ['Theft', 'Assault', 'Flood', 'Car Accident', 'Blocked Lane'];
  showPreview = false;

  incident = {
    category: '',
    barangay: '',
    landmark: '',
    description: '',
    date: '',
    time: '',
  };

  reportType: 'onsite' | 'map' = 'onsite';
  pinLat: number | null = null;
  pinLng: number | null = null;

  maxDate: string = '';
  timeMax: string = '';

  // Polygon data (unchanged)
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
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private route: ActivatedRoute,
    private geolocation: Geolocation
  ) {}

  async ngOnInit() {
    const now = new Date();
    this.maxDate = now.toISOString().split('T')[0];
    this.updateTimeMax();
    this.incident.date = this.maxDate;
    this.incident.time = this.getCurrentTime();

    this.route.queryParams.subscribe(async (params) => {
      if (params['lat'] && params['lng']) {
        this.pinLat = parseFloat(params['lat']);
        this.pinLng = parseFloat(params['lng']);
        this.reportType = 'map';
        this.incident.barangay =
          this.getBarangayForLocation(this.pinLat, this.pinLng) || '';
      } else {
        this.reportType = 'onsite';
        try {
          const position = await this.geolocation.getCurrentPosition();
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const detectedBarangay = this.getBarangayForLocation(lat, lng);
          if (detectedBarangay) {
            this.incident.barangay = detectedBarangay;
          } else {
            const toast = await this.toastCtrl.create({
              message:
                'Unable to detect your barangay. Please move closer to a supported area.',
              duration: 3000,
              color: 'warning',
              position: 'top',
            });
            await toast.present();
          }
        } catch {
          const toast = await this.toastCtrl.create({
            message: 'Failed to get your location. Please enable GPS.',
            duration: 3000,
            color: 'danger',
            position: 'top',
          });
          await toast.present();
        }
      }
    });
  }

  getCurrentTime(): string {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  }

  updateTimeMax() {
    const now = new Date();
    this.timeMax = now.toTimeString().slice(0, 5);
  }

  onDateChange() {
    this.timeMax =
      this.incident.date === this.maxDate ? this.getCurrentTime() : '23:59';
  }

  goBack() {
    this.navCtrl.back();
  }

  // Polygon point check
  getBarangayForLocation(lat: number, lng: number): string | null {
    const point = L.latLng(lat, lng);
    for (const [name, coords] of Object.entries(this.POLYGONS)) {
      const polygon = L.polygon(coords as L.LatLngExpression[]);
      if (
        polygon.getBounds().contains(point) &&
        this.pointInPolygon(point, polygon)
      ) {
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

  // Step 1: validate before showing preview
  async openPreview() {
    if (
      !this.incident.category ||
      !this.incident.barangay ||
      !this.incident.landmark ||
      !this.incident.date ||
      !this.incident.time
    ) {
      const toast = await this.toastCtrl.create({
        message: 'Please fill out all required fields.',
        duration: 2000,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    // ⏰ Time validation
    const selectedDateTime = new Date(`${this.incident.date}T${this.incident.time}`);
    const now = new Date();

    if (selectedDateTime > now) {
      const toast = await this.toastCtrl.create({
        message: 'Selected time cannot be in the future.',
        duration: 2500,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    this.showPreview = true;
  }

  // Step 2: submit
  async confirmSubmit() {
    this.showPreview = false;

    const auth = getAuth();
    const user = auth.currentUser;
    const firestore = getFirestore();

    if (!user) {
      const toast = await this.toastCtrl.create({
        message: 'You must be logged in to submit a report.',
        duration: 2000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
      return;
    }

    try {
      let lat: number, lng: number;
      if (this.reportType === 'map' && this.pinLat && this.pinLng) {
        lat = this.pinLat;
        lng = this.pinLng;
      } else {
        const position = await this.geolocation.getCurrentPosition();
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }

      const combinedDateTime = new Date(
        `${this.incident.date}T${this.incident.time}`
      );

      await addDoc(collection(firestore, 'reports'), {
        category: this.incident.category,
        barangay: this.incident.barangay,
        landmark: this.incident.landmark,
        description:
          this.incident.description || 'No description provided',
        datetime: combinedDateTime.toISOString(),
        lat,
        lng,
        reportType: this.reportType,
        status: 'pending',
        userId: user.uid,
        userRole: user.email?.includes('admin') ? 'admin' : 'user',
        createdAt: Timestamp.now(),
      });

      const toast = await this.toastCtrl.create({
        message: 'Incident report submitted successfully!',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();

      const now = new Date();
      this.incident = {
        category: '',
        barangay: '',
        landmark: '',
        description: '',
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().slice(0, 5),
      };
    } catch (error) {
      console.error('Error saving report:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to submit report. Please try again.',
        duration: 2000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    }
  }
}
