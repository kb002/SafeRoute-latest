import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors
} from '@angular/forms';
import {
  IonContent, IonButton, IonIcon, IonCheckbox, IonInput,
  ToastController, AlertController
} from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';

import { auth, db } from 'src/app/firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: true,
  imports: [
    IonContent, CommonModule, ReactiveFormsModule,
    IonButton, RouterLink, IonIcon, IonCheckbox, IonInput
  ]
})
export class SignupPage implements OnInit {
  signupForm!: FormGroup;
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.signupForm = this.fb.group(
      {
        username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-z0-9 _]+$/)]],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.required, Validators.pattern(/^[9]\d{9}$/)]],
        address: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/)]],
        confirmPassword: ['', [Validators.required]],
        acceptTerms: [false, [Validators.requiredTrue]],
      },
      { validators: this.passwordsMatchValidator }
    );
  }

  private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordMismatch: true };
  }

  get username() { return this.signupForm.get('username'); }
  get email() { return this.signupForm.get('email'); }
  get phone() { return this.signupForm.get('phone'); }
  get address() { return this.signupForm.get('address'); }
  get password() { return this.signupForm.get('password'); }
  get confirmPassword() { return this.signupForm.get('confirmPassword'); }
  get acceptTerms() { return this.signupForm.get('acceptTerms'); }

  numbersOnly(event: any) {
    const value = event.target.value;
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10); 
    this.signupForm.patchValue({ phone: digitsOnly }, { emitEvent: false });
  }

  async showToast(message: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    toast.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirmPassword() { this.showConfirmPassword = !this.showConfirmPassword; }

  async onSubmit() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      if (!this.acceptTerms?.value) this.showToast('You need to agree to the Terms of Service and Privacy Policy.');
      if (this.signupForm.errors?.['passwordMismatch']) this.showToast('Passwords do not match.');
      return;
    }

    this.isSubmitting = true;

    try {
      const { email, password, username, phone, address, acceptTerms } = this.signupForm.value;

      if (!acceptTerms) {
        this.showToast('You need to agree to the Terms of Service and Privacy Policy.');
        this.isSubmitting = false;
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firebase Auth profile with displayName (username)
      await updateProfile(user, { displayName: username.trim() });

      // Send email verification
      await sendEmailVerification(user);

      // Save user in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        username: username.trim(),
        email,
        //Save with +63 prefix
        phone: `+63${phone}`,
        address: address.trim(),
        createdAt: serverTimestamp()
      });

      // Save username in AuthService
      this.authService.setUsername(username.trim());

      // Force sign out until email is verified
      await signOut(auth);

      // Show alert instead of toast
      await this.showAlert('Sign Up Successful', 'Please verify your email before logging in.');
      this.router.navigateByUrl('/login', { replaceUrl: true });

    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') this.showToast('This email is already registered.');
      else this.showToast(error.message || 'Signup failed. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }
}
