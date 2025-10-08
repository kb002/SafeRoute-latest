import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor() {}

  // Get current location once
  async getCurrentLocation() {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      return {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  // Watch location in real-time
  async watchLocation(callback: (coords: { lat: number; lng: number }) => void) {
    try {
      const watchId = await Geolocation.watchPosition({}, (position, err) => {
        if (err) {
          console.error('Error watching location:', err);
          return;
        }
        if (position) {
          callback({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      });

      return watchId;
    } catch (error) {
      console.error('Error setting up watch:', error);
      return null;
    }
  }

  // Stop watching
  async clearWatch(watchId: string) {
    await Geolocation.clearWatch({ id: watchId });
  }
}
