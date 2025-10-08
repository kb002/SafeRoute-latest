import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, indexedDBLocalPersistence, initializeAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { provideHttpClient } from '@angular/common/http'; 

// ✅ Import the Geolocation plugin
import { Geolocation } from '@awesome-cordova-plugins/geolocation/ngx';

// ✅ Initialize Firebase app ONCE before Angular starts
const firebaseApp = initializeApp(environment.firebaseConfig);

// ✅ Initialize Auth with persistence BEFORE bootstrap
const auth = initializeAuth(firebaseApp, {
  persistence: indexedDBLocalPersistence, // survives refresh
});

// ✅ Initialize Firestore once
const db = getFirestore(firebaseApp);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideFirebaseApp(() => firebaseApp),
    provideAuth(() => auth),
    provideFirestore(() => db),
    provideHttpClient(),

    // ✅ Add Geolocation here so Angular knows how to inject it
    Geolocation,
  ],
});
