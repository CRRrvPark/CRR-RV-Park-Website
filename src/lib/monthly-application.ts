/**
 * Monthly extended-stay application — parse a Netlify Forms submission
 * into a structured record the PDF + office email can share.
 *
 * Do not include ip / user_agent / referrer in anything we email or file.
 */

import { EXTENDED_STAYS } from './availability';

export const MONTHLY_APPLICATION_FORM = 'monthly-application';

export interface MonthlyApplication {
  id: string;
  number: string;
  submittedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mailingAddress: string;
  dateOfBirth: string;
  returningGuest: string;
  moveInDate: string;
  moveOutDate: string;
  rvYear: string;
  rvMake: string;
  rvModel: string;
  rvLength: string;
  rvAge: string;
  rigType: string;
  rvInsurance: string;
  occupants: string[];
  pets: PetRecord[];
  petConsent: boolean;
  vehicles: string[];
  histories: HousingRecord[];
  notes: string;
  consent: boolean;
  seasonEndLabel: string;
}

export interface PetRecord {
  name: string;
  breed: string;
  weight: string;
  age: string;
  sex: string;
  fixed: boolean;
  vaccinated: boolean;
}

export interface HousingRecord {
  address: string;
  dates: string;
  type: string;
  reason: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export interface NetlifyFormSubmission {
  id?: string;
  number?: number | string;
  form_id?: string;
  form_name?: string;
  created_at?: string;
  email?: string;
  name?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function str(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean).join(', ');
  return String(v).trim();
}

export function isChecked(value: string): boolean {
  const s = value.trim().toLowerCase();
  return s === 'yes' || s === 'on' || s === 'true' || s === '1';
}

function returningLabel(value: string): string {
  const s = value.trim().toLowerCase();
  if (s === 'no' || s.startsWith('no')) return 'No, first time';
  if (s === 'yes' || s.startsWith('yes')) return 'Yes, returning guest';
  return value;
}

export function isHoneypot(payload: NetlifyFormSubmission): boolean {
  const data = payload.data ?? {};
  return str(data, 'bot-field').length > 0;
}

export function isMonthlyApplication(payload: NetlifyFormSubmission): boolean {
  const name = String(payload.form_name ?? '').trim();
  if (name) return name === MONTHLY_APPLICATION_FORM;
  const subject = str(payload.data ?? {}, 'subject').toLowerCase();
  return subject.includes('monthly') && subject.includes('application');
}

function occupied(parts: string[]): boolean {
  return parts.some(p => p.length > 0);
}

export function parseMonthlyApplication(payload: NetlifyFormSubmission): MonthlyApplication {
  const data = payload.data ?? {};
  const pets: PetRecord[] = [];
  for (const n of [1, 2] as const) {
    const pet: PetRecord = {
      name: str(data, `pet_${n}_name`),
      breed: str(data, `pet_${n}_breed`),
      weight: str(data, `pet_${n}_weight`),
      age: str(data, `pet_${n}_age`),
      sex: str(data, `pet_${n}_sex`),
      fixed: isChecked(str(data, `pet_${n}_fixed`)),
      vaccinated: isChecked(str(data, `pet_${n}_vaccinated`)),
    };
    if (occupied([pet.name, pet.breed, pet.weight, pet.age, pet.sex])) pets.push(pet);
  }

  const histories: HousingRecord[] = [];
  for (const n of [1, 2, 3] as const) {
    const row: HousingRecord = {
      address: str(data, `history_${n}_address`),
      dates: str(data, `history_${n}_dates`),
      type: str(data, `history_${n}_type`),
      reason: str(data, `history_${n}_reason`),
      contactName: str(data, `history_${n}_contact_name`),
      contactPhone: str(data, `history_${n}_contact_phone`),
      contactEmail: str(data, `history_${n}_contact_email`),
    };
    if (occupied(Object.values(row))) histories.push(row);
  }

  const occupants = [str(data, 'occupant_1'), str(data, 'occupant_2'), str(data, 'occupant_3')].filter(Boolean);
  const vehicles = [str(data, 'vehicle_1'), str(data, 'vehicle_2')].filter(Boolean);

  return {
    id: String(payload.id ?? ''),
    number: payload.number != null ? String(payload.number) : '',
    submittedAt: String(payload.created_at ?? ''),
    firstName: str(data, 'first_name') || (String(payload.name ?? '').split(' ')[0] ?? ''),
    lastName: str(data, 'last_name'),
    email: str(data, 'email') || String(payload.email ?? ''),
    phone: str(data, 'phone'),
    mailingAddress: str(data, 'mailing_address'),
    dateOfBirth: str(data, 'date_of_birth'),
    returningGuest: returningLabel(str(data, 'returning_guest')),
    moveInDate: str(data, 'move_in_date'),
    moveOutDate: str(data, 'move_out_date'),
    rvYear: str(data, 'rv_year'),
    rvMake: str(data, 'rv_make'),
    rvModel: str(data, 'rv_model'),
    rvLength: str(data, 'rv_length'),
    rvAge: str(data, 'rv_age'),
    rigType: str(data, 'rig_type'),
    rvInsurance: str(data, 'rv_insurance'),
    occupants,
    pets,
    petConsent: isChecked(str(data, 'pet_consent')),
    vehicles,
    histories,
    notes: str(data, 'message'),
    consent: isChecked(str(data, 'consent')),
    seasonEndLabel: EXTENDED_STAYS.seasonEndLabel,
  };
}

export function fullName(app: MonthlyApplication): string {
  return `${app.firstName} ${app.lastName}`.trim() || 'Unknown applicant';
}

export function formatIsoDate(iso: string): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function formatSubmittedAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  })} PT`;
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw || '—';
}

export function pdfFilename(app: MonthlyApplication): string {
  const last = (app.lastName || 'applicant').replace(/[^A-Za-z0-9]+/g, '-');
  const first = (app.firstName || 'unknown').replace(/[^A-Za-z0-9]+/g, '-');
  const day = (app.submittedAt || '').slice(0, 10) || 'undated';
  return `CRR-Monthly-Application-${last}-${first}-${day}.pdf`;
}
