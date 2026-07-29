import { CheckCircle2, Clock3, ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorBox, Loader } from '../components/UI';
import { api } from '../lib/api';
import type { MembershipPayment } from '../types';

type BankInstructions = { displayName:string; reference:string; amount:number; currency:string; bankDetails:{ bankName:string; accountName:string; accountNumber:string; routingNumber:string; iban:string; swift:string; instructions:string } };

export default function MembershipSuccess(){
  const [params]=useSearchParams();
  const paymentId=params.get('payment_id')||'';
  const provider=params.get('provider')||'';
  const orderId=params.get('token')||params.get('order_id')||'';
  const reference=params.get('reference')||'';
  const [payment,setPayment]=useState<MembershipPayment|null>(null);
  const [bank,setBank]=useState<BankInstructions|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    let stopped=false;let timer:number|undefined;
    async function check(){
      try{
        if(provider==='paypal'&&orderId)await api('/memberships/paypal/capture',{method:'POST',body:JSON.stringify({orderId})});
        if(!paymentId)throw new Error('Membership payment reference is missing.');
        const row=await api<MembershipPayment>(`/memberships/payment/${paymentId}`);
        if(provider==='bank_transfer'&&!bank){
          const instructions=await api<BankInstructions>(`/memberships/manual/${paymentId}`);
          if(!stopped)setBank(instructions);
        }
        if(stopped)return;
        setPayment(row);setLoading(false);
        if(['pending','processing'].includes(row.status)&&provider!=='bank_transfer')timer=window.setTimeout(check,2500);
      }catch(e){if(!stopped){setError(e instanceof Error?e.message:'Membership status could not be confirmed.');setLoading(false)}}
    }
    void check();
    return()=>{stopped=true;if(timer)window.clearTimeout(timer)};
  },[paymentId,provider,orderId]);

  if(loading)return <div className="page-center"><Loader/></div>;
  if(error)return <div className="page-center"><ErrorBox message={error}/></div>;
  const paid=payment?.status==='paid';
  return <section className="section membership-success-page"><div className="container narrow"><div className={`success-card ${paid?'paid':'pending'}`}>
    {paid?<CheckCircle2/>:<Clock3/>}<span className="eyebrow">Membership payment</span><h1>{paid?'Your membership is active':'Payment is awaiting confirmation'}</h1>
    <p>{paid?'Your plan access has been applied automatically. Open your dashboard to use your membership benefits.':provider==='bank_transfer'?'Complete the bank transfer using the reference below. An administrator will verify it and activate your membership.':'The payment provider is still confirming the transaction. This page updates automatically.'}</p>
    {(reference||bank?.reference)&&<div className="reference-box"><span>Transfer reference</span><strong>{reference||bank?.reference}</strong></div>}
    {bank&&<div className="bank-instructions-card"><h2>{bank.displayName}</h2><p>{bank.bankDetails.instructions}</p><dl>{bank.bankDetails.bankName&&<div><dt>Bank</dt><dd>{bank.bankDetails.bankName}</dd></div>}{bank.bankDetails.accountName&&<div><dt>Account name</dt><dd>{bank.bankDetails.accountName}</dd></div>}{bank.bankDetails.accountNumber&&<div><dt>Account number</dt><dd>{bank.bankDetails.accountNumber}</dd></div>}{bank.bankDetails.routingNumber&&<div><dt>Routing number</dt><dd>{bank.bankDetails.routingNumber}</dd></div>}{bank.bankDetails.iban&&<div><dt>IBAN</dt><dd>{bank.bankDetails.iban}</dd></div>}{bank.bankDetails.swift&&<div><dt>SWIFT</dt><dd>{bank.bankDetails.swift}</dd></div>}</dl></div>}
    {payment&&<div className="receipt-summary"><div><span>Plan</span><strong>{payment.plan?.name||'Membership'}</strong></div><div><span>Billing</span><strong>{payment.billing_cycle.replace('_',' ')}</strong></div><div><span>Amount</span><strong>{payment.currency.toUpperCase()} {Number(payment.amount).toFixed(2)}</strong></div><div><span>Status</span><strong>{payment.status}</strong></div>{payment.receipt_number&&<div><span>Receipt</span><strong>{payment.receipt_number}</strong></div>}</div>}
    <div className="hero-actions"><Link className="button" to="/dashboard">Open dashboard</Link><Link className="button ghost" to="/membership"><ReceiptText/>Membership plans</Link></div>
  </div></div></section>;
}
