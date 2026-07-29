import { env } from '../config/env.js';
import { supabaseAdmin } from './supabase.js';
import { queueEmail } from './email.js';

export async function queueDonationReceiptEmail(donation: any) {
  if (!donation?.donor_email || !donation?.receipt_token || donation.payment_status !== 'paid') return;
  const receiptUrl = `${env.APP_URL}/receipt/${donation.receipt_token}`;
  await queueEmail({
    to: donation.donor_email,
    name: donation.donor_name,
    templateKey: 'donation_receipt',
    subject: `Donation receipt ${donation.receipt_number || ''}`.trim(),
    payload: {
      receiptNumber: donation.receipt_number,
      amount: `${String(donation.currency).toUpperCase()} ${donation.amount}`,
      designation: donation.designation,
      receiptUrl
    },
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#2d2030"><h1 style="color:#5a146b">Women Rise Legacy</h1><p>Thank you, ${escapeHtml(donation.donor_name)}.</p><p>Your donation of <strong>${String(donation.currency).toUpperCase()} ${donation.amount}</strong> for ${escapeHtml(donation.designation)} has been received.</p><p>Receipt: <strong>${donation.receipt_number || 'Processing'}</strong></p><p><a href="${receiptUrl}">View your receipt</a></p></div>`
  });
  await supabaseAdmin.from('donations').update({ receipt_sent_at: new Date().toISOString() }).eq('id', donation.id);
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}
