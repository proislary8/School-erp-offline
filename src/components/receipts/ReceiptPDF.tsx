import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 32,
    color: '#1a202c',
    backgroundColor: '#ffffff',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#2d3748',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  schoolName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1a202c',
    marginBottom: 3,
  },
  receiptTitle: {
    fontSize: 11,
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  receiptNo: {
    fontSize: 10,
    color: '#718096',
    textAlign: 'right',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
  },
  rowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  label: { color: '#718096', flex: 1 },
  value: { fontFamily: 'Helvetica-Bold', color: '#1a202c', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: '#2d3748',
    borderTopStyle: 'solid',
    marginTop: 8,
  },
  totalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1a202c' },
  totalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#276749' },
  lateFeeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
  },
  lateFeeLabel: { color: '#c53030', flex: 1 },
  lateFeeValue: { fontFamily: 'Helvetica-Bold', color: '#c53030', textAlign: 'right' },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  balanceLabel: { color: '#c53030', fontFamily: 'Helvetica-Bold', flex: 1 },
  balanceValue: { fontFamily: 'Helvetica-Bold', color: '#c53030', textAlign: 'right' },
  footer: {
    marginTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#a0aec0',
    fontSize: 9,
  },
  stamp: {
    marginTop: 28,
    alignItems: 'flex-end',
  },
  stampLine: {
    width: 120,
    borderTopWidth: 0.5,
    borderTopColor: '#2d3748',
    borderTopStyle: 'solid',
    paddingTop: 4,
    fontSize: 9,
    color: '#718096',
    textAlign: 'center',
  },
})

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export interface ReceiptData {
  receipt_no:   number
  student_name: string
  student_id:   string
  class_grade:  string
  section_type: string
  fee_head:     string
  amount_due:   number
  amount_paid:  number
  late_fee:     number
  payment_date: string | null
  payment_mode: string | null
  cheque_no:    string | null
  utr_ref:      string | null
  staff_name:   string
  school_name:  string
  receipt_prefix: string
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const balance = Math.max(0, data.amount_due - data.amount_paid)
  const generated = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Document>
      <Page size={[226, 'auto' as unknown as number]} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{data.school_name}</Text>
          <Text style={styles.receiptTitle}>Fee Payment Receipt</Text>
        </View>

        <Text style={styles.receiptNo}>Receipt No: {data.receipt_prefix}-{data.receipt_no}</Text>

        {/* Student Info */}
        <Text style={styles.sectionTitle}>Student Details</Text>
        {[
          ['Student Name', data.student_name],
          ['Student ID',   data.student_id],
          ['Class',        `Class ${data.class_grade}`],
          ['Section',      data.section_type],
        ].map(([label, value], i, arr) => (
          <View key={label} style={i === arr.length - 1 ? styles.rowLast : styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}

        {/* Payment Info */}
        <Text style={styles.sectionTitle}>Payment Details</Text>
        {[
          ['Fee Head',      data.fee_head],
          ['Payment Date',  data.payment_date ? new Date(data.payment_date).toLocaleDateString('en-IN') : '—'],
          ['Payment Mode',  data.payment_mode ?? '—'],
          ...(data.cheque_no ? [['Cheque No.',  data.cheque_no]] : []),
          ...(data.utr_ref   ? [['UTR / Ref',   data.utr_ref]]   : []),
          ['Amount Due',    fmt(data.amount_due)],
        ].map(([label, value], i, arr) => (
          <View key={label} style={i === arr.length - 1 ? styles.rowLast : styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}

        {/* Late fee */}
        {data.late_fee > 0 && (
          <View style={styles.lateFeeLine}>
            <Text style={styles.lateFeeLabel}>Late Fee (penalty)</Text>
            <Text style={styles.lateFeeValue}>{fmt(data.late_fee)}</Text>
          </View>
        )}

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Amount Paid</Text>
          <Text style={styles.totalValue}>{fmt(data.amount_paid)}</Text>
        </View>

        {/* Balance */}
        {balance > 0 && (
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance Due</Text>
            <Text style={styles.balanceValue}>{fmt(balance)}</Text>
          </View>
        )}

        {/* Stamp */}
        <View style={styles.stamp}>
          <View style={styles.stampLine}>
            <Text>{data.staff_name}</Text>
            <Text style={{ color: '#a0aec0' }}>Authorised Signatory</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated: {generated}</Text>
          <Text>This is a computer-generated receipt</Text>
        </View>
      </Page>
    </Document>
  )
}
