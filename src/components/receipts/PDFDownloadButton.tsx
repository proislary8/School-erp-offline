'use client'
import { pdf } from '@react-pdf/renderer'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { ReceiptDocument, type ReceiptData } from './ReceiptPDF'

export default function PDFDownloadButton({ data }: { data: ReceiptData }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const blob = await pdf(<ReceiptDocument data={data} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `receipt-${data.receipt_prefix}-${data.receipt_no}-${data.student_name.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className="btn btn-primary btn-sm"
      onClick={handleDownload}
      disabled={loading}
      title="Download PDF"
    >
      {loading
        ? <div className="spinner" style={{ width: 12, height: 12 }} />
        : <Download size={13} />
      }
    </button>
  )
}
