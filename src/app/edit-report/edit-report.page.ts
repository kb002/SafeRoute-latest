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

  categories = ['Theft', 'Assault', 'Flood', 'Car Accident', 'Blocked Lane'];
  barangays = ['Carig Norte', 'Carig Sur', 'Linao East', 'Linao West', 'Linao Norte'];

  maxDate: string = '';
  maxTime: string = '';

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

    // Copy existing report data
    this.editData = { ...this.report };

    // Convert datetime (ISO) to date and time fields
    if (this.report.datetime) {
      const dt = new Date(this.report.datetime);
      this.editData.date = dt.toISOString().split('T')[0];
      this.editData.time = dt.toTimeString().slice(0, 5);
    }

    this.setMaxDateTime();
  }

  setMaxDateTime() {
    const now = new Date();
    this.maxDate = now.toISOString().split('T')[0];
    this.maxTime = now.toTimeString().slice(0, 5);
  }

  onDateChange() {
    const now = new Date();
    const selectedDate = new Date(this.editData.date);

    // If the selected date is today, limit the time to current time
    if (selectedDate.toDateString() === now.toDateString()) {
      this.maxTime = now.toTimeString().slice(0, 5);
    } else {
      // Otherwise, allow any time
      this.maxTime = '23:59';
    }

    // Reset time if it exceeds the new max
    if (this.editData.time && this.editData.time > this.maxTime) {
      this.editData.time = this.maxTime;
    }
  }

  async saveEdit() {
    if (!this.editData.category || !this.editData.barangay || !this.editData.date || !this.editData.time) {
      this.showToast('Please fill out all required fields.', 'warning');
      return;
    }

    const now = new Date();
    const combinedDateTime = new Date(`${this.editData.date}T${this.editData.time}`);

    if (combinedDateTime > now) {
      this.showToast('Date and time cannot be in the future.', 'warning');
      return;
    }

    const firestore = getFirestore();
    const docRef = doc(firestore, 'reports', this.report.id);

    try {
      await updateDoc(docRef, {
        category: this.editData.category,
        barangay: this.editData.barangay,
        landmark: this.editData.landmark,
        description: this.editData.description || 'No description provided',
        datetime: combinedDateTime.toISOString(),
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
