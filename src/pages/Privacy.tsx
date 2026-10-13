import { ArrowLeft } from 'lucide-react'
import { BRAND } from '../lib/supabase'
import { useLang } from '../lib/i18n'

type Sec = [string, string[]]
const PRIVACY: Record<'el' | 'en', Sec[]> = {
  el: [
    ['Υπεύθυνος επεξεργασίας', ['Υπεύθυνος επεξεργασίας είναι η ακαδημία ποδοσφαίρου «Patras Schools Soccer», Πάτρα. Για οποιοδήποτε θέμα σχετικά με τα δεδομένα σας επικοινωνήστε με τη γραμματεία της ακαδημίας.']],
    ['Ποια δεδομένα τηρούμε', ['Στοιχεία αθλητή: ονοματεπώνυμο, ημερομηνία γέννησης, ΑΜΚΑ, διεύθυνση, ομάδα, θέση.', 'Στοιχεία γονέων/κηδεμόνων: ονοματεπώνυμο, τηλέφωνο, email.', 'Δεδομένα υγείας (μόνο με συγκατάθεση): ιατρική βεβαίωση, αλλεργίες, τραυματισμοί.', 'Σωματομετρικά & αθλητικές επιδόσεις (μόνο με συγκατάθεση): ύψος, βάρος, τεστ, αξιολογήσεις, στόχοι.', 'Παρουσίες, συμμετοχές σε αγώνες, στατιστικά.', 'Οικονομικά: χρεώσεις συνδρομών, πληρωμές, αποδείξεις.', 'Φωτογραφίες/βίντεο (μόνο με συγκατάθεση).']],
    ['Γιατί τα χρησιμοποιούμε', ['Για την εγγραφή και συμμετοχή του αθλητή στα τμήματα της ακαδημίας.', 'Για την ασφάλεια του αθλητή (έλεγχος ιατρικής καταλληλότητας, διαχείριση τραυματισμών).', 'Για την αθλητική του εξέλιξη (αξιολογήσεις, προσωπικοί στόχοι).', 'Για την οικονομική διαχείριση (χρεώσεις, αποδείξεις, υπενθυμίσεις οφειλών).', 'Για την επικοινωνία με τους γονείς (ανακοινώσεις, επείγουσες ειδοποιήσεις).']],
    ['Νομική βάση', ['Συγκατάθεση του γονέα/κηδεμόνα (άρθρα 6§1α και 9§2α ΓΚΠΔ), εκτέλεση της σύμβασης συμμετοχής (άρθρο 6§1β) και έννομη υποχρέωση για φορολογικά στοιχεία (άρθρο 6§1γ).']],
    ['Ποιος έχει πρόσβαση', ['Η γραμματεία και η διοίκηση της ακαδημίας.', 'Οι προπονητές — μόνο για τους αθλητές των ομάδων τους (παρουσίες, υγεία, επιδόσεις), χωρίς πρόσβαση στα οικονομικά.', 'Οι γονείς — μόνο για τα δικά τους παιδιά.', 'Πάροχοι υπηρεσιών που μας εξυπηρετούν (φιλοξενία δεδομένων Supabase σε κέντρο δεδομένων στη Φρανκφούρτη/ΕΕ, αποστολή email). Τα δεδομένα δεν πωλούνται και δεν διαβιβάζονται εκτός ΕΕ για εμπορικούς σκοπούς.']],
    ['Πόσο καιρό τα κρατάμε', ['Όσο ο αθλητής είναι μέλος της ακαδημίας και έως 2 έτη μετά την αποχώρησή του. Τα οικονομικά στοιχεία τηρούνται όσο ορίζει η φορολογική νομοθεσία. Μετά τα δεδομένα διαγράφονται ή ανωνυμοποιούνται.']],
    ['Τα δικαιώματά σας', ['Πρόσβαση: μπορείτε να ζητήσετε αντίγραφο όλων των δεδομένων (το παρέχουμε σε ηλεκτρονική μορφή).', 'Διόρθωση λανθασμένων στοιχείων.', 'Διαγραφή / ανωνυμοποίηση μετά την αποχώρηση.', 'Ανάκληση οποιασδήποτε συγκατάθεσης ανά πάσα στιγμή, χωρίς να επηρεάζεται η νομιμότητα της επεξεργασίας πριν την ανάκληση.', 'Φορητότητα και εναντίωση.', 'Καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (www.dpa.gr).']],
    ['Ασφάλεια', ['Κρυπτογραφημένη σύνδεση (HTTPS), πρόσβαση ανά ρόλο, σύνδεση 2 βημάτων για το προσωπικό, εβδομαδιαία αντίγραφα ασφαλείας. Τα αρχεία (ιατρικές βεβαιώσεις, δελτία) αποθηκεύονται σε ιδιωτικό χώρο και ανοίγουν μόνο με προσωρινό σύνδεσμο.']],
  ],
  en: [
    ['Data controller', ['The data controller is the football academy “Patras Schools Soccer”, Patras, Greece. For any question about your data please contact the academy office.']],
    ['What data we keep', ['Player details: full name, date of birth, social security number (AMKA), address, team, position.', 'Parent/guardian details: full name, phone, email.', 'Health data (only with consent): medical certificate, allergies, injuries.', 'Body measurements & athletic performance (only with consent): height, weight, tests, evaluations, goals.', 'Attendance, match participation, statistics.', 'Financial: membership charges, payments, receipts.', 'Photos/videos (only with consent).']],
    ['Why we use it', ['To register the player and run the academy squads.', "For the player's safety (medical eligibility checks, injury management).", 'For athletic development (evaluations, individual goals).', 'For financial management (charges, receipts, balance reminders).', 'To communicate with parents (announcements, urgent alerts).']],
    ['Legal basis', ['Consent of the parent/guardian (GDPR Art. 6(1)(a) and 9(2)(a)), performance of the participation agreement (Art. 6(1)(b)) and legal obligation for tax records (Art. 6(1)(c)).']],
    ['Who has access', ['The academy office and management.', 'Coaches — only for players in their own teams (attendance, health, performance), with no access to finances.', 'Parents — only for their own children.', 'Service providers acting on our behalf (Supabase data hosting in Frankfurt/EU, email delivery). Data is never sold or transferred outside the EU for commercial purposes.']],
    ['How long we keep it', ['While the player is a member of the academy and up to 2 years after leaving. Financial records are kept as long as tax law requires. Data is then deleted or anonymised.']],
    ['Your rights', ['Access: you can request a copy of all data (we provide it electronically).', 'Rectification of incorrect data.', 'Erasure / anonymisation after leaving.', 'Withdrawal of any consent at any time, without affecting processing carried out before withdrawal.', 'Portability and objection.', 'Complaint to the Hellenic Data Protection Authority (www.dpa.gr).']],
    ['Security', ['Encrypted connection (HTTPS), role-based access, two-step sign-in for staff, weekly backups. Files (medical certificates, player cards) are stored privately and opened only via temporary links.']],
  ],
}
const TERMS: Record<'el' | 'en', Sec[]> = {
  el: [
    ['Συμμετοχή', ['Η συμμετοχή σε προπονήσεις και αγώνες προϋποθέτει έγκυρη ιατρική βεβαίωση. Αθλητής χωρίς έγκυρη βεβαίωση δεν μπορεί να συμμετέχει.', 'Ο γονέας ενημερώνει άμεσα τη γραμματεία για κάθε θέμα υγείας ή τραυματισμό.']],
    ['Συνδρομές', ['Η μηνιαία συνδρομή χρεώνεται την 1η κάθε μήνα σύμφωνα με την τιμολογιακή πολιτική της ακαδημίας (ανά ομάδα και αριθμό παιδιών της οικογένειας).', 'Υπενθύμιση οφειλής αποστέλλεται στις 15 και στις 20 του μήνα. Για κάθε πληρωμή εκδίδεται απόδειξη στο email του γονέα.', 'Εκπτώσεις/υποτροφίες εγκρίνονται από τη διοίκηση.']],
    ['Συμπεριφορά', ['Αθλητές και γονείς τηρούν τους κανόνες ευγενούς άμιλλας και σεβασμού προς προπονητές, συμπαίκτες, αντιπάλους και διαιτητές.']],
    ['Αποχώρηση', ['Η αποχώρηση δηλώνεται στη γραμματεία· η χρέωση σταματά από τον επόμενο μήνα.']],
  ],
  en: [
    ['Participation', ['Taking part in training and matches requires a valid medical certificate. A player without one cannot take part.', 'Parents must inform the office promptly of any health issue or injury.']],
    ['Fees', ["The monthly fee is charged on the 1st of each month according to the academy's pricing policy (per team and number of children in the family).", 'Balance reminders are sent on the 15th and 20th of the month. A receipt is emailed to the parent for every payment.', 'Discounts/scholarships are approved by the management.']],
    ['Conduct', ['Players and parents respect fair play and show respect to coaches, teammates, opponents and referees.']],
    ['Leaving', ['Leaving must be declared to the office; charges stop from the following month.']],
  ],
}

export default function Privacy() {
  const { lang, setLang, t } = useLang()
  const terms = window.location.hash.startsWith('#/terms')
  const secs = (terms ? TERMS : PRIVACY)[lang]
  return <div className="public">
    <div className="public-head"><img src={BRAND + 'pss-logo.png'} alt="Patras Schools Soccer" />
      <div className="head" style={{ fontSize: 24, fontWeight: 800, textTransform: 'uppercase', marginTop: 6 }}>Patras Schools Soccer</div>
      <div style={{ color: '#ff8a9b', letterSpacing: 3, fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>{terms ? t('terms') : t('privacy')}</div>
      <div className="lang" style={{ marginTop: 10 }}><button className={lang === 'el' ? 'on' : ''} onClick={() => setLang('el')}>ΕΛ</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button></div></div>
    <div className="public-body">
      <div className="card" style={{ lineHeight: 1.6 }}>
        {secs.map(([h, ps]) => <div key={h} style={{ marginBottom: 16 }}><h2 style={{ marginBottom: 6 }}>{h}</h2>{ps.length > 1 ? <ul style={{ margin: 0, paddingLeft: 20 }}>{ps.map((p) => <li key={p}>{p}</li>)}</ul> : <p style={{ margin: 0 }}>{ps[0]}</p>}</div>)}
        <div className="muted" style={{ fontSize: 12.5 }}>{lang === 'el' ? 'Τελευταία ενημέρωση' : 'Last updated'}: 13/10/2026</div>
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 16, marginTop: 16, fontSize: 14 }}>
        <a href="#/register"><ArrowLeft size={14} /> {lang === 'el' ? 'Εγγραφή' : 'Registration'}</a>
        <a href={terms ? '#/privacy' : '#/terms'}>{terms ? t('privacy') : t('terms')}</a>
        <a href="#/">{lang === 'el' ? 'Είσοδος' : 'Sign in'}</a>
      </div>
    </div>
  </div>
}
