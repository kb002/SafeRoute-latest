import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { BottomNavComponent } from '../components/bottom-nav/bottom-nav.component';
import { Router } from '@angular/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  styleUrls: ['./report.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, BottomNavComponent],
})
export class ReportPage implements OnInit, OnDestroy {
  categories: string[] = ['Theft', 'Assault', 'Flood', 'Car Accident', 'Blocked Lane', 'Others'];
  selectedCategory: string = 'all';
  reports: any[] = [];
  loading = true;
  private unsubscribeReports: (() => void) | null = null;
  private unsubscribeAuth: (() => void) | null = null;

  constructor(
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    this.waitForUserAndListen();
  }

  /** Wait for Firebase Auth to load before listening to Firestore */
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

  /** Real-time listener for reports */
  listenToReports(userId: string) {
    this.loading = true;
    const firestore = getFirestore();
    const reportsRef = collection(firestore, 'reports');
    const q = query(reportsRef, where('userId', '==', userId));

    // detach previous listener if any
    if (this.unsubscribeReports) {
      this.unsubscribeReports();
    }

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

  /** Filters reports by selected category */
  get filteredReports() {
    if (this.selectedCategory === 'all') {
      return this.reports;
    }
    return this.reports.filter((report) => report.category === this.selectedCategory);
  }

  /** Navigate back */
  goBack() {
    this.navCtrl.back();
  }

  /** Navigate to Add Report page */
  addReport() {
    this.navCtrl.navigateForward('/add-incident');
  }

  /** Navigate to view a specific report */
  viewReport(reportId: string) {
    this.router.navigate(['/view-report', reportId]);
  }

  /** Toast helper */
  async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: 'warning',
      position: 'top',
    });
    await toast.present();
  }

  /** Unsubscribe when leaving page */
  ngOnDestroy() {
    if (this.unsubscribeReports) this.unsubscribeReports();
    if (this.unsubscribeAuth) this.unsubscribeAuth();
  }
}
