import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewContactsPage } from './view-contacts.page';

describe('ViewContactsPage', () => {
  let component: ViewContactsPage;
  let fixture: ComponentFixture<ViewContactsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewContactsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
