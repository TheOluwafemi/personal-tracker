import { Component, ViewChild, ElementRef } from '@angular/core';
import { Plugins } from '@capacitor/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AngularFirestoreCollection, AngularFirestore } from '@angular/fire/firestore';
const { Geolocation } = Plugins;

declare var google;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  locations: Observable<any>;
  locationsCollection: AngularFirestoreCollection<any>;
  user = null;

  @ViewChild('map', {static: true}) mapElement: ElementRef;
  map: any;
  markers = [];
  isTracking = false;
  watch: string;
  currentCoords = null;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore
    ) {
    this.anonLogin();
  }

  ionViewWillEnter() {
    // this.extractCurrentPosition();
    this.loadMap();
  }

  extractCurrentPosition() {
    const getLocationInfo = Geolocation.getCurrentPosition().then(res => {
      this.currentCoords = res.coords;
      console.log(this.currentCoords);
    });
  }

  loadMap() {
    const latLng = new google.maps.LatLng(6.5243793, 3.3792057);
    const mapOptions = {
      center: latLng,
      zoom: 5,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    this.map = new google.maps.Map(this.mapElement.nativeElement, mapOptions);
  }

  anonLogin() {
    this.afAuth.auth.signInAnonymously().then(res => {
      this.user = res.user;

      this.locationsCollection = this.afs.collection(
        `locations/${this.user.uid}/track`,
        ref => ref.orderBy('timestamp')
      );

      this.locations = this.locationsCollection.snapshotChanges().pipe(
        map(actions =>
          actions.map(a => {
            const data = a.payload.doc.data();
            const id = a.payload.doc.id;
            return { id, ...data };
          })
          )
      );

      this.locations.subscribe(locations => {
        this.updateMap(locations);
      });
    });
  }

  updateMap(locations) {
    this.markers.map(marker => marker.setMap(null));
    this.markers = [];

    for (let loc of locations) {
      const latLng = new google.maps.LatLng(loc.lat, loc.lng);
      const marker = new google.maps.Marker({
        map: this.map,
        animation: google.maps.Animation.DROP,
        position: latLng
      });
      this.markers.push(marker);
    }
  }

  startTracking() {
    this.isTracking = true;
    this.watch = Geolocation.watchPosition({}, (position, err) => {
      console.log('new position', position);
      if (position) {
        this.addNewLocation(
          position.coords.latitude,
          position.coords.longitude,
          position.timestamp
        );
      }
    });
  }

  stopTracking() {
    Geolocation.clearWatch({ id: this.watch }).then(() => {
      this.isTracking = false;
    });
  }

  addNewLocation(lat, lng, timestamp) {
    this.locationsCollection.add({
      lat,
      lng,
      timestamp
    });

    const position = new google.maps.LatLng(lat, lng);
    this.map.setCenter(position);
    this.map.setZoom(5);
  }

  deleteLocation(pos) {
    this.locationsCollection.doc(pos.id).delete();
  }

}
