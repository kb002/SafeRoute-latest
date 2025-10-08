import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  ToastController,
  NavController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';

interface Contact {
  name: string;
  email: string;
  relationship: string;
  createdAt?: any;
}

@Component({
  selector: 'app-add-contact',
  templateUrl: './add-contact.page.html',
  styleUrls: ['./add-contact.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption
  ]
})
export class AddContactPage {
  newContact: Contact = { name: '', email: '', relationship: '' };

  relationshipOptions: string[] = [
    'Mother',
    'Father',
    'Sibling',
    'Relative',
    'Friend',
    'Spouse',
    'Guardian'
  ];

  constructor(
    private navCtrl: NavController,
    private firestore: Firestore,
    private auth: Auth,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  goBack() {
    this.navCtrl.back();
  }

  async saveContact() {
    const user = this.auth.currentUser;
    if (!user) {
      this.showToast('You must be logged in to add contacts', 'danger');
      return;
    }

    const { name, email, relationship } = this.newContact;

    if (!name || !email || !relationship) {
      this.showToast('All fields are required', 'warning');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showToast('Please enter a valid email address', 'warning');
      return;
    }

    try {
      const contactsRef = collection(
        this.firestore,
        `users/${user.uid}/emergency_contacts`
      );
      await addDoc(contactsRef, {
        ...this.newContact,
        createdAt: serverTimestamp()
      });

      this.showToast('Contact added successfully', 'success');
      this.navCtrl.back();
    } catch {
      this.showToast('Failed to add contact', 'danger');
    }
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
