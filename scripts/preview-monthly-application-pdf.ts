/**
 * Write a sample monthly-application PDF next to this script so we can
 * eyeball layout without submitting a live form.
 *
 *   npx tsx scripts/preview-monthly-application-pdf.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMonthlyApplication } from '../src/lib/monthly-application';
import { buildMonthlyApplicationPdf } from '../src/lib/monthly-application-pdf';

const fixture = {
  id: 'preview-fixture',
  number: 7,
  form_name: 'monthly-application',
  created_at: '2026-09-19T17:00:00.000Z',
  data: {
    first_name: 'Jordan',
    last_name: 'Example',
    email: 'jordan.example@email.test',
    phone: '5415550142',
    mailing_address: '123 Canyon Rim Rd, Terrebonne, OR 97760',
    date_of_birth: '1978-04-12',
    returning_guest: 'No — first time',
    move_in_date: '2026-10-01',
    move_out_date: '2027-04-30',
    rv_year: '2019',
    rv_make: 'Winnebago',
    rv_model: 'View 24D',
    rv_length: '25',
    rv_age: '7',
    rig_type: 'Class C Motorhome',
    rv_insurance: 'Progressive',
    occupant_1: 'Jordan Example, 48, applicant',
    occupant_2: 'Sam Example, 46, spouse',
    occupant_3: '',
    pet_1_name: 'Scout',
    pet_1_breed: 'Australian Shepherd mix',
    pet_1_weight: '42',
    pet_1_age: '5 years',
    pet_1_sex: 'Female',
    pet_1_fixed: 'Yes',
    pet_1_vaccinated: 'Yes',
    pet_2_name: '',
    pet_2_breed: '',
    pet_consent: 'Yes',
    vehicle_1: '2018 Ford F-150, OR ABC-123',
    vehicle_2: '',
    history_1_address: 'Sunset RV Park, Bend, OR',
    history_1_dates: 'Oct 2025 – Apr 2026',
    history_1_type: 'RV Park / Campground',
    history_1_reason: 'Season ended',
    history_1_contact_name: 'Park manager',
    history_1_contact_phone: '5415550199',
    history_1_contact_email: 'manager@example.test',
    history_2_address: '441 Pine St, Redmond, OR',
    history_2_dates: 'Jan 2023 – Sep 2025',
    history_2_type: 'Owned Home',
    history_2_reason: 'Sold home',
    history_2_contact_name: 'N/A',
    message: 'Prefer a quieter site toward the rim if one is open. Happy to provide insurance card at check-in.',
    consent: 'on',
  },
};

const app = parseMonthlyApplication(fixture);
const pdf = await buildMonthlyApplicationPdf(app);
const { PDFDocument } = await import('pdf-lib');
const loaded = await PDFDocument.load(pdf);
const out = resolve(dirname(fileURLToPath(import.meta.url)), '_backups', 'sample-monthly-application.pdf');
writeFileSync(out, pdf);
console.log('Wrote', out, pdf.byteLength, 'bytes,', loaded.getPageCount(), 'pages');
