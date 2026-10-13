import { useEffect, useState } from 'react'

export type Lang = 'el' | 'en'
const KEY = 'pss_lang'
const get = (): Lang => { try { return (localStorage.getItem(KEY) as Lang) || (navigator.language?.startsWith('el') ? 'el' : 'el') } catch { return 'el' } }

export function useLang() {
  const [lang, setL] = useState<Lang>(get)
  useEffect(() => { const f = () => setL(get()); window.addEventListener('pss-lang', f); return () => window.removeEventListener('pss-lang', f) }, [])
  const setLang = (l: Lang) => { try { localStorage.setItem(KEY, l) } catch { /* */ } setL(l); document.documentElement.lang = l; window.dispatchEvent(new Event('pss-lang')) }
  const t = (k: keyof typeof EL) => (lang === 'en' ? EN[k] : EL[k]) ?? EL[k]
  return { lang, setLang, t }
}

const EL = {
  reg_title: 'ΗΛΕΚΤΡΟΝΙΚΗ ΕΓΓΡΑΦΗ ΑΘΛΗΤΗ', sent: 'Η εγγραφή στάλθηκε!', sent_text: 'Ευχαριστούμε! Η γραμματεία της ακαδημίας θα ελέγξει την αίτηση και θα επικοινωνήσει μαζί σας.',
  step: 'Βήμα', of: 'από', athlete: 'Στοιχεία αθλητή', first: 'Όνομα', last: 'Επώνυμο', birth: 'Ημερομηνία γέννησης', amka: 'ΑΜΚΑ', address: 'Διεύθυνση', team: 'Ομάδα', team_unknown: 'Δεν ξέρω / θα ενημερωθώ',
  position: 'Θέση', prev_club: 'Προηγούμενος σύλλογος', health: 'Υγεία', med_until: 'Η ιατρική βεβαίωση ισχύει έως', med_file: 'Ιατρική βεβαίωση (φωτογραφία ή PDF)', choose_file: 'Επιλογή αρχείου', allergies: 'Αλλεργίες / θέματα υγείας που πρέπει να γνωρίζουμε',
  parents: 'Στοιχεία γονέων', parents_note: 'Στο email θα λαμβάνετε αποδείξεις πληρωμών και ενημερώσεις οφειλών.', guardian1: 'Γονέας / κηδεμόνας 1', guardian2: 'Γονέας / κηδεμόνας 2 (προαιρετικά)', relation: 'Σχέση', mobile: 'Κινητό',
  consents_t: 'Συγκαταθέσεις & υπογραφή', gdpr_note: 'Σύμφωνα με τον Γενικό Κανονισμό Προστασίας Δεδομένων (ΓΚΠΔ/GDPR), η επεξεργασία δεδομένων ανηλίκων απαιτεί τη συγκατάθεση του γονέα. Μπορείτε να ανακαλέσετε οποιαδήποτε συγκατάθεση ανά πάσα στιγμή επικοινωνώντας με τη γραμματεία.',
  required: '(υποχρεωτικό)', optional: '(προαιρετικό)', signer: 'Ονοματεπώνυμο γονέα που υπογράφει', signature: 'Υπογραφή', clear: 'Καθαρισμός', back: 'Πίσω', next: 'Επόμενο', sending: 'Αποστολή…', finish: 'Ολοκλήρωση εγγραφής',
  e_child: 'Συμπλήρωσε όνομα, επώνυμο και ημερομηνία γέννησης του αθλητή.', e_g1: 'Συμπλήρωσε τα στοιχεία του 1ου γονέα (όνομα, επώνυμο, κινητό, email).', e_email: 'Το email δεν φαίνεται σωστό.',
  e_consent: 'Οι υποχρεωτικές συγκαταθέσεις πρέπει να επιλεγούν για να ολοκληρωθεί η εγγραφή.', e_signer: 'Γράψε το ονοματεπώνυμο του γονέα που υπογράφει.', e_sign: 'Υπόγραψε στο πλαίσιο υπογραφής.', e_generic: 'Κάτι πήγε στραβά: ',
  read_privacy: 'Διάβασε την Πολιτική Απορρήτου και τους Όρους Συμμετοχής', privacy: 'Πολιτική Απορρήτου', terms: 'Όροι Συμμετοχής',
  c_data: 'Συγκατάθεση για την επεξεργασία των προσωπικών δεδομένων του αθλητή και των κηδεμόνων για τη λειτουργία της ακαδημίας (εγγραφή, επικοινωνία, οικονομικά).',
  c_health: 'Συγκατάθεση για την τήρηση δεδομένων υγείας (ιατρική βεβαίωση, αλλεργίες, σημειώσεις υγείας).',
  c_biometrics: 'Συγκατάθεση για την καταγραφή σωματομετρικών στοιχείων και αθλητικών επιδόσεων (ύψος, βάρος, τεστ φυσικής κατάστασης, αξιολογήσεις).',
  c_media: 'Συγκατάθεση για τη λήψη και δημοσίευση φωτογραφιών/βίντεο από προπονήσεις και αγώνες στα μέσα του συλλόγου.',
  // Γονείς
  p_hello: 'Καλώς ήρθατε', p_kids: 'Τα παιδιά μου', p_balance: 'Υπόλοιπο', p_paid: 'Εξοφλημένο', p_due: 'Οφειλή', p_finance: 'Οικονομικά', p_perf: 'Επιδόσεις', p_news: 'Ανακοινώσεις', p_photos: 'Φωτογραφίες', p_goals: 'Στόχοι', p_health: 'Υγεία',
  p_statement: 'Κατάσταση λογαριασμού (PDF)', p_receipt: 'Απόδειξη', p_charges: 'Χρεώσεις', p_payments: 'Πληρωμές', p_nothing: 'Δεν υπάρχουν ακόμα στοιχεία', p_logout: 'Αποσύνδεση', p_team: 'Ομάδα', p_medical: 'Ιατρική βεβαίωση έως',
  p_injury: 'Τραυματισμός', p_returned: 'Επέστρεψε', p_open_injury: 'Σε αποθεραπεία', p_no_news: 'Δεν υπάρχουν ανακοινώσεις', p_no_photos: 'Δεν υπάρχουν φωτογραφίες', p_overview: 'Επισκόπηση', p_month: 'Μήνας', p_amount: 'Ποσό', p_date: 'Ημερομηνία', p_method: 'Τρόπος',
}
const EN: typeof EL = {
  reg_title: 'ONLINE PLAYER REGISTRATION', sent: 'Registration sent!', sent_text: 'Thank you! The academy office will review the application and contact you.',
  step: 'Step', of: 'of', athlete: 'Player details', first: 'First name', last: 'Last name', birth: 'Date of birth', amka: 'Social security no. (AMKA)', address: 'Address', team: 'Team', team_unknown: "I don't know / will be informed",
  position: 'Position', prev_club: 'Previous club', health: 'Health', med_until: 'Medical certificate valid until', med_file: 'Medical certificate (photo or PDF)', choose_file: 'Choose file', allergies: 'Allergies / health issues we should know about',
  parents: 'Parent details', parents_note: 'Payment receipts and balance notices are sent to this email.', guardian1: 'Parent / guardian 1', guardian2: 'Parent / guardian 2 (optional)', relation: 'Relationship', mobile: 'Mobile',
  consents_t: 'Consents & signature', gdpr_note: "Under the General Data Protection Regulation (GDPR), processing a minor's data requires parental consent. You may withdraw any consent at any time by contacting the office.",
  required: '(required)', optional: '(optional)', signer: 'Full name of signing parent', signature: 'Signature', clear: 'Clear', back: 'Back', next: 'Next', sending: 'Sending…', finish: 'Complete registration',
  e_child: "Please fill in the player's first name, last name and date of birth.", e_g1: 'Please fill in parent 1 details (name, surname, mobile, email).', e_email: 'The email address does not look valid.',
  e_consent: 'The required consents must be ticked to complete registration.', e_signer: 'Please type the full name of the signing parent.', e_sign: 'Please sign in the signature box.', e_generic: 'Something went wrong: ',
  read_privacy: 'Read the Privacy Policy and Terms of Participation', privacy: 'Privacy Policy', terms: 'Terms of Participation',
  c_data: "Consent to process the personal data of the player and guardians for running the academy (registration, communication, finances).",
  c_health: 'Consent to keep health data (medical certificate, allergies, health notes).',
  c_biometrics: 'Consent to record body measurements and athletic performance (height, weight, fitness tests, evaluations).',
  c_media: "Consent to take and publish photos/videos from training sessions and matches on the club's channels.",
  p_hello: 'Welcome', p_kids: 'My children', p_balance: 'Balance', p_paid: 'Paid up', p_due: 'Amount due', p_finance: 'Payments', p_perf: 'Performance', p_news: 'Announcements', p_photos: 'Photos', p_goals: 'Goals', p_health: 'Health',
  p_statement: 'Account statement (PDF)', p_receipt: 'Receipt', p_charges: 'Charges', p_payments: 'Payments', p_nothing: 'Nothing here yet', p_logout: 'Sign out', p_team: 'Team', p_medical: 'Medical certificate until',
  p_injury: 'Injury', p_returned: 'Returned', p_open_injury: 'Recovering', p_no_news: 'No announcements', p_no_photos: 'No photos', p_overview: 'Overview', p_month: 'Month', p_amount: 'Amount', p_date: 'Date', p_method: 'Method',
}
export const REL_EN: Record<string, string> = { 'Πατέρας': 'Father', 'Μητέρα': 'Mother', 'Κηδεμόνας': 'Guardian', 'Παππούς/Γιαγιά': 'Grandparent', 'Ο ίδιος (ενήλικας)': 'Self (adult)' }
export const POS_EN: Record<string, string> = { 'Τερματοφύλακας': 'Goalkeeper', 'Αμυντικός': 'Defender', 'Μέσος': 'Midfielder', 'Επιθετικός': 'Forward' }
