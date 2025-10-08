import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private usernameSubject = new BehaviorSubject<string | null>(null);
  username$ = this.usernameSubject.asObservable();

  constructor() {
    // Listen to Firebase auth state changes
    onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        const displayName = user.displayName ? user.displayName : user.email;
        this.usernameSubject.next(displayName);
      } else {
        this.usernameSubject.next(null);
      }
    });
  }

  //allow manual update (important for signup)
  setUsername(username: string) {
    this.usernameSubject.next(username);
  }

  // Expose the current username synchronously
  getCurrentUsername(): string | null {
    return this.usernameSubject.value;
  }
}
