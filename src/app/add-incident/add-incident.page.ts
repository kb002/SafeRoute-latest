import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Geolocation } from '@awesome-cordova-plugins/geolocation/ngx';

@Component({
  selector: 'app-add-incident',
  templateUrl: './add-incident.page.html',
  styleUrls: ['./add-incident.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class AddIncidentPage {
  categories = ['Theft', 'Assault', 'Flood', 'Car Accident', 'Blocked Lane', 'Others'];
  barangays = ['Carig Norte', 'Carig Sur', 'Linao East', 'Linao West', 'Linao Norte'];

  incident = {
    category: '',
    otherCategory: '',
    barangay: '',
    landmark: '',
    description: '',
    date: '',
    time: ''
  };

  showOtherCategory = false;

  constructor(
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private geolocation: Geolocation
  ) {}

  goBack() {
    this.navCtrl.back();
  }

  onCategoryChange() {
    this.showOtherCategory = this.incident.category === 'Others';
  }

  async submitReport() {
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
      // Get user's current location
      const position = await this.geolocation.getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Combine date + time into one Date object
      const combinedDateTime = new Date(`${this.incident.date}T${this.incident.time}`);

      const reportData = {
        category: this.showOtherCategory ? this.incident.otherCategory : this.incident.category,
        barangay: this.incident.barangay,
        landmark: this.incident.landmark,
        description: this.incident.description || 'No description provided',
        datetime: combinedDateTime.toISOString(),
        lat,
        lng,
        status: 'pending',
        userId: user.uid,
        userRole: user.email?.includes('admin') ? 'admin' : 'user',
        createdAt: Timestamp.now()
      };

      await addDoc(collection(firestore, 'reports'), reportData);

      const toast = await this.toastCtrl.create({
        message: 'Incident report submitted successfully!',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();

      // Reset form
      this.incident = {
        category: '',
        otherCategory: '',
        barangay: '',
        landmark: '',
        description: '',
        date: '',
        time: ''
      };
      this.showOtherCategory = false;

    } catch (error) {
      console.error('Error saving report or getting location:', error);
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
