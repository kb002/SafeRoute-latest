import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

interface Contact {
  id?: string;
  name: string;
  email: string;
  relationship: string;
  createdAt?: any;
}

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ContactsPage implements OnInit, OnDestroy {
  user: User | null = null;
  contacts: Contact[] = [];
  loading = true;
  private authUnsub?: () => void;
  private contactsSub?: Subscription;

  constructor(
    private navCtrl: NavController,
    private auth: Auth,
    private firestore: Firestore,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    this.authUnsub = onAuthStateChanged(this.auth, async (user) => {
      this.user = user;
      if (user) {
        await this.loadContacts(user.uid);
      }
      this.loading = false;
    });
  }

  ngOnDestroy() {
    if (this.authUnsub) this.authUnsub();
    if (this.contactsSub) this.contactsSub.unsubscribe();
  }

  private async loadContacts(uid: string) {
    try {
      const contactsRef = collection(
        this.firestore,
        `users/${uid}/emergency_contacts`
      );
      this.contactsSub = collectionData(contactsRef, { idField: 'id' }).subscribe(
        (data: any[]) => {
          this.contacts = data.map((doc) => ({
            id: doc.id,
            name: doc.name,
            email: doc.email,
            relationship: doc.relationship,
            createdAt: doc.createdAt
          }));
        },
        () => this.showToast('Failed to load contacts', 'danger')
      );
    } catch {
      this.showToast('Failed to load contacts', 'danger');
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  viewContact(contact: Contact) {
    if (contact.id) {
      this.navCtrl.navigateForward(['/view-contacts', contact.id]);
    }
  }

  async addContact() {
    if (!this.user) {
      this.showToast('You must be logged in to add contacts', 'danger');
      return;
    }

    if (this.contacts.length >= 3) {
      this.showToast('You can have maximum of 3 Emergency Contacts', 'warning');
      return;
    }

    this.navCtrl.navigateForward(['/add-contact']);
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
