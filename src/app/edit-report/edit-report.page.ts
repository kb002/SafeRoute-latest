import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

@Component({
  selector: 'app-edit-report',
  templateUrl: './edit-report.page.html',
  styleUrls: ['./edit-report.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class EditReportPage implements OnInit {
  report: any = {};
  editData: any = {};
  showOtherCategory = false;

  categories = ['Theft', 'Assault', 'Flood', 'Car Accident', 'Blocked Lane', 'Others'];
  barangays = ['Carig Norte', 'Carig Sur', 'Linao East', 'Linao West', 'Linao Norte'];

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    this.report = nav?.extras?.state?.['report'];

    if (!this.report) {
      this.showToast('No report data found.', 'warning');
      this.navCtrl.navigateBack('/report');
      return;
    }

    // ✅ Copy report data for editing
    this.editData = { ...this.report };
    this.showOtherCategory = this.editData.category === 'Others';
  }

  onCategoryChange() {
    this.showOtherCategory = this.editData.category === 'Others';
  }

  async saveEdit() {
    if (!this.editData.category || !this.editData.barangay) {
      this.showToast('Please fill out required fields.', 'warning');
      return;
    }

    const firestore = getFirestore();
    const docRef = doc(firestore, 'reports', this.report.id);

    const updatedCategory =
      this.showOtherCategory && this.editData.otherCategory
        ? this.editData.otherCategory
        : this.editData.category;

    try {
      await updateDoc(docRef, {
        category: updatedCategory,
        barangay: this.editData.barangay,
        landmark: this.editData.landmark,
        description: this.editData.description || '',
      });

      this.showToast('Report updated successfully.', 'success');
      this.navCtrl.navigateBack('/report');
    } catch (err) {
      console.error('Error updating report:', err);
      this.showToast('Failed to update report.', 'warning');
    }
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
}
