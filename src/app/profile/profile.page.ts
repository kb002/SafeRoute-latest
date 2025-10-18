import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ToastController } from '@ionic/angular';
import {
  Auth,
  onAuthStateChanged,
  User,
  signOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User | null = null;
  address: string | null = null;
  phone: string | null = null;
  loading = true;
  isEditModalOpen = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showPasswordFields = false;
  private authUnsub?: () => void;

  editValues: any = { username: '', phone: '', address: '', password: '', currentPassword: '' };
  errors: any = { username: '', phone: '', address: '', password: '', currentPassword: '' };

  constructor(
    public navCtrl: NavController,
    private auth: Auth,
    private firestore: Firestore,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.authUnsub = onAuthStateChanged(this.auth, async (user) => {
      this.user = user;
      if (user) {
        await this.loadUserData(user.uid);
        this.editValues.username = user.displayName || '';
      } else {
        this.address = null;
        this.phone = null;
      }
      this.loading = false;
    });
  }

  ngOnDestroy() {
    if (this.authUnsub) this.authUnsub();
  }

  private async loadUserData(uid: string) {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();

        // Phone
        this.phone = data['phone'] || "No Phone";
        this.editValues.phone =
          this.phone && this.phone !== "No Phone"
            ? this.phone.replace('+63', '')
            : '';

        // Address
        this.address = data['address'] || "No Address";
        this.editValues.address =
          this.address && this.address !== "No Address"
            ? this.address
            : '';

        // Username
        if (data['username']) {
          this.editValues.username = data['username'];
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }


  openEditModal() {
    this.errors = {};
    this.editValues.username = this.user?.displayName || '';
    this.editValues.phone = this.phone ? this.phone.replace('+63', '') : '';
    this.editValues.address = this.address || '';
    this.editValues.password = '';
    this.editValues.currentPassword = '';
    this.showNewPassword = false;
    this.showCurrentPassword = false;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
  }

  numbersOnly(event: any) {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
    this.editValues.phone = event.target.value;
  }

  validateUsername() {
    const value = this.editValues.username.trim();
    const usernameRegex = /^(?! )[A-Za-z0-9_ ]{3,20}(?<! )$/;
    const noDoubleSpaces = !/ {2,}/.test(this.editValues.username);
    if (!value) this.errors.username = 'Username is required.';
    else if (!usernameRegex.test(this.editValues.username) || !noDoubleSpaces)
      this.errors.username = '3–20 chars, letters/numbers/underscores/spaces only, no leading/trailing or double spaces.';
    else this.errors.username = '';
  }

  validateAddress() {
    const len = this.editValues.address.trim().length;
    if (!len) this.errors.address = 'Address is required.';
    else if (len < 5) this.errors.address = 'Address must be at least 5 characters.';
    else if (len > 100) this.errors.address = 'Address cannot exceed 100 characters.';
    else this.errors.address = '';
  }

  validateNewPassword() {
    const val = this.editValues.password;
    const passRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,20}$/;
    if (!val) this.errors.password = '';
    else if (!passRegex.test(val))
      this.errors.password = '6–20 chars, must include at least 1 letter and 1 number.';
    else this.errors.password = '';
  }

  validateCurrentPassword() {
    if (this.showPasswordFields && !this.editValues.currentPassword)
      this.errors.currentPassword = 'Enter your current password.';
    else this.errors.currentPassword = '';
  }

  async saveAllEdits() {
    if (!this.user) return;
    const uid = this.user.uid;
    const userRef = doc(this.firestore, `users/${uid}`);

    // Run validations
    this.validateUsername();
    this.validateAddress();
    this.validateNewPassword();
    this.validateCurrentPassword();

    // Phone validation
    if (!this.editValues.phone) this.errors.phone = 'Phone number is required.';
    else if (!/^\d{10}$/.test(this.editValues.phone))
      this.errors.phone = 'Enter a valid 10-digit phone number.';
    else this.errors.phone = '';

    if (Object.values(this.errors).some((err) => err)) return;

    try {
      // Update username
      await updateProfile(this.user, { displayName: this.editValues.username });
      await updateDoc(userRef, { username: this.editValues.username });

      // Update phone (add +63 prefix)
      const fullPhone = `+63${this.editValues.phone}`;
      await updateDoc(userRef, { phone: fullPhone });
      this.phone = fullPhone;

      // Update address
      await updateDoc(userRef, { address: this.editValues.address });
      this.address = this.editValues.address;

      // Password update
      if (this.editValues.password) {
        const credential = EmailAuthProvider.credential(
          this.user.email!,
          this.editValues.currentPassword
        );
        await reauthenticateWithCredential(this.user, credential);
        await updatePassword(this.user, this.editValues.password);
        this.showToast('Password updated successfully', 'success');
      }

      this.showToast('Profile updated successfully', 'success');
      this.closeEditModal();

    } catch (err: any) {
      console.error('Error saving profile:', err);
      this.showToast('Update failed. Try again.', 'danger');
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  togglePassword(field: 'current' | 'new') {
    if (field === 'current') this.showCurrentPassword = !this.showCurrentPassword;
    else this.showNewPassword = !this.showNewPassword;
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top',
    });
    await toast.present();
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.showToast('Logged Out Successfully', 'success');
      this.navCtrl.navigateRoot('/login');
    } catch {
      this.showToast('Logout failed. Try again.', 'danger');
    }
  }
}
