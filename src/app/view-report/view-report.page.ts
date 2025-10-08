import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { getFirestore, doc, onSnapshot, deleteDoc } from 'firebase/firestore';

@Component({
  selector: 'app-view-report',
  templateUrl: './view-report.page.html',
  styleUrls: ['./view-report.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class ViewReportPage implements OnInit, OnDestroy {
  reportId!: string;
  report: any = null;
  loading = true;
  private unsubscribeReport: (() => void) | null = null;

  constructor(
    private navCtrl: NavController,
    private route: ActivatedRoute,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router
  ) {}

  ngOnInit() {
    this.reportId = this.route.snapshot.paramMap.get('id')!;
    if (this.reportId) {
      this.listenToReport();
    } else {
      this.loading = false;
      this.showToast('Invalid report ID.', 'warning');
    }
  }

  listenToReport() {
    const firestore = getFirestore();
    const docRef = doc(firestore, 'reports', this.reportId);

    this.unsubscribeReport = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          let datetime: Date | null = null;
          const raw = data['datetime'];

          if (raw) {
            if (typeof raw.toDate === 'function') datetime = raw.toDate();
            else if (raw.seconds) datetime = new Date(raw.seconds * 1000);
            else if (raw instanceof Date) datetime = raw;
            else if (typeof raw === 'string' || typeof raw === 'number') datetime = new Date(raw);
          }

          this.report = { id: snapshot.id, ...data, datetime };
        } else {
          this.report = null;
        }
        this.loading = false;
      },
      (error) => {
        console.error('Error loading report:', error);
        this.showToast('Failed to load report.', 'warning');
        this.loading = false;
      }
    );
  }

  handleEditClick() {
    if (this.report.status !== 'pending') {
      this.showToast('You cannot edit verified or unverified reports.', 'warning');
      return;
    }

    // ✅ Navigate to Edit Report Page
    this.router.navigate(['/edit-report'], { state: { report: this.report } });
  }

  async handleDeleteClick() {
    if (this.report.status !== 'pending') {
      this.showToast('You cannot delete verified or unverified reports.', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Delete Report',
      message: 'Are you sure you want to permanently delete this report?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            try {
              const firestore = getFirestore();
              await deleteDoc(doc(firestore, 'reports', this.reportId));
              await this.showToast('Report deleted successfully.', 'success');
              this.navCtrl.navigateBack('/report');
            } catch (err) {
              console.error(err);
              this.showToast('Failed to delete report.', 'warning');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  goBack() {
    this.navCtrl.back();
  }

  async showToast(message: string, color: 'success' | 'warning' = 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    });
    await toast.present();
  }

  ngOnDestroy() {
    if (this.unsubscribeReport) this.unsubscribeReport();
  }
}
