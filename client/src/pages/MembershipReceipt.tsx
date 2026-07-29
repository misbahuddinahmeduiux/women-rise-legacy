import { Crown, Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, Loader } from '../components/UI';
import { Seo } from '../components/Seo';
import { api } from '../lib/api';

export default function MembershipReceipt() {
  const { token } = useParams();
  const [receipt, setReceipt] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/memberships/receipt/${token}`).then(setReceipt).catch((e) => setError(e.message)); }, [token]);
  if (error) return <div className="page-center"><ErrorBox message={error} /></div>;
  if (!receipt) return <Loader />;
  return <section className="receipt-page"><Seo title={`Membership Receipt ${receipt.receipt_number || ''}`} description="Women Rise Legacy membership payment receipt." noIndex /><article className="receipt-card"><header><img src="/assets/brand/logo.webp" alt="Women Rise Legacy" /><div><span>Official membership receipt</span><h1>{receipt.receipt_number}</h1></div></header><div className="receipt-thanks"><Crown /><div><h2>Membership activated</h2><p>Thank you for investing in your Women Rise Legacy journey.</p></div></div><dl><div><dt>Member</dt><dd>{receipt.profile?.full_name || 'Women Rise Legacy member'}</dd></div><div><dt>Plan</dt><dd>{receipt.plan?.name || 'Membership'}</dd></div><div><dt>Billing</dt><dd>{String(receipt.billing_cycle).replace('_', ' ')}</dd></div><div><dt>Provider</dt><dd>{String(receipt.provider).replace('_', ' ')}</dd></div><div><dt>Amount</dt><dd>{String(receipt.currency).toUpperCase()} {Number(receipt.amount).toFixed(2)}</dd></div><div><dt>Paid</dt><dd>{new Date(receipt.paid_at || receipt.created_at).toLocaleString()}</dd></div></dl><p className="receipt-note">This receipt confirms a verified membership payment recorded by Women Rise Legacy. Keep it for your records.</p></article><div className="receipt-actions"><button className="button" onClick={() => window.print()}><Printer />Print / Save PDF</button><Link className="button ghost" to="/dashboard"><Download />Return to dashboard</Link></div></section>;
}
