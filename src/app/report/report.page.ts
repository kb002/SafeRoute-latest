import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { BottomNavComponent } from '../components/bottom-nav/bottom-nav.component';
import { Router } from '@angular/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
import * as L from 'leaflet';
import { Geolocation } from '@awesome-cordova-plugins/geolocation/ngx';

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  styleUrls: ['./report.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, BottomNavComponent],
})
export class ReportPage implements OnInit, OnDestroy {
  categories: string[] = ['Theft', 'Assault', 'Flood', 'Car Accident', 'Blocked Lane'];
  selectedCategory: string = 'all';
  selectedSort: string = 'desc';
  reports: any[] = [];
  loading = true;

  private unsubscribeReports: (() => void) | null = null;
  private unsubscribeAuth: (() => void) | null = null;

  //Barangay boundaries
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
    private alertCtrl: AlertController,
    private router: Router,
    private geolocation: Geolocation
  ) {}

  ngOnInit() {
    this.waitForUserAndListen();
  }

  waitForUserAndListen() {
    const auth = getAuth();
    this.unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        this.listenToReports(user.uid);
      } else {
        this.reports = [];
        this.loading = false;
        this.showToast('Please log in to view your reports.');
      }
    });
  }

  listenToReports(userId: string) {
    this.loading = true;
    const firestore = getFirestore();
    const reportsRef = collection(firestore, 'reports');
    const q = query(reportsRef, where('userId', '==', userId));

    if (this.unsubscribeReports) this.unsubscribeReports();

    this.unsubscribeReports = onSnapshot(
      q,
      (snapshot) => {
        this.reports = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        this.loading = false;
      },
      (error) => {
        console.error('Error listening to reports:', error);
        this.showToast('Failed to fetch reports.');
        this.loading = false;
      }
    );
  }

  get filteredAndSortedReports() {
    let filtered =
      this.selectedCategory === 'all'
        ? this.reports
        : this.reports.filter((r) => r.category === this.selectedCategory);
    return filtered.sort((a, b) => {
      const da = new Date(a.datetime).getTime();
      const db = new Date(b.datetime).getTime();
      return this.selectedSort === 'asc' ? da - db : db - da;
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  async addReport() {
    try {
      const position = await this.geolocation.getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const barangay = this.getBarangayForLocation(lat, lng);

      if (!barangay) {
        const alert = await this.alertCtrl.create({
          header: 'Outside Covered Barangays',
          message:
            'You are currently outside the covered barangays. You can still report an incident by selecting a covered location on the map.',
          cssClass: 'custom-alert', 
          buttons: [
            {
              text: 'Go to Map',
              handler: () => {
                this.navCtrl.navigateForward('/map');
              },
              cssClass: 'left-btn', 
            },
            {
              text: 'OK',
              role: 'cancel',
              cssClass: 'right-btn', 
            },
          ],
        });
        await alert.present();
        return;
      }

      this.navCtrl.navigateForward('/add-incident');
    } catch (error) {
      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to detect your location. Please enable GPS and try again.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  getBarangayForLocation(lat: number, lng: number): string | null {
    const point = L.latLng(lat, lng);
    for (const [name, coords] of Object.entries(this.POLYGONS)) {
      const polygon = L.polygon(coords as L.LatLngExpression[]);
      if (polygon.getBounds().contains(point) && this.pointInPolygon(point, polygon)) {
        return name;
      }
    }
    return null;
  }

  pointInPolygon(point: L.LatLng, polygon: L.Polygon): boolean {
    const poly = polygon.getLatLngs()[0] as L.LatLng[];
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].lat,
        yi = poly[i].lng;
      const xj = poly[j].lat,
        yj = poly[j].lng;
      const intersect =
        yi > point.lng !== yj > point.lng &&
        point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  async viewReport(reportId: string) {
    this.router.navigate(['/view-report', reportId]);
  }

  async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: 'warning',
      position: 'top',
    });
    await toast.present();
  }

  ngOnDestroy() {
    if (this.unsubscribeReports) this.unsubscribeReports();
    if (this.unsubscribeAuth) this.unsubscribeAuth();
  }
}
