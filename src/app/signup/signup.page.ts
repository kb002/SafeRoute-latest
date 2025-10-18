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
        username: [
          '',
          [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(20),
            Validators.pattern(/^[A-Za-z0-9 _]+$/),
            this.noConsecutiveSpacesValidator,
            this.noLeadingTrailingSpacesValidator
          ]
        ],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
        phone: ['', [Validators.required, Validators.pattern(/^[9]\d{9}$/)]],
        address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.maxLength(20),
            Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-={}[\]:;"'<>,.?/]{6,20}$/)
          ]
        ],
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

  private noConsecutiveSpacesValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (value && /\s{2,}/.test(value)) {
      return { noConsecutiveSpaces: true };
    }
    return null;
  }

  private noLeadingTrailingSpacesValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (value && (value.startsWith(' ') || value.endsWith(' '))) {
      return { noLeadingTrailingSpaces: true };
    }
    return null;
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
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
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
      let { email, password, username, phone, address, acceptTerms } = this.signupForm.value;

      username = username.trim().replace(/\s+/g, ' ');

      if (!acceptTerms) {
        this.showToast('You need to agree to the Terms of Service and Privacy Policy.');
        this.isSubmitting = false;
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: username });
      await sendEmailVerification(user);

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        username,
        email,
        phone: `+63${phone}`,
        address: address.trim(),
        createdAt: serverTimestamp()
      });

      this.authService.setUsername(username);
      await signOut(auth);

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
