import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import { About, DonationSuccess, GetInvolved, Programs } from './pages/StaticPages';
import { CampaignDetail, Campaigns, CurrentNeeds, FamilyDetail, NeedDetail, SponsorFamilies } from './pages/ListPages';
import { Contact, Donate, DonateItems, Partners, RequestAssistance, ShipmentTracking, Volunteer } from './pages/Forms';
import { Login, Register } from './pages/AuthPages';
import Impact from './pages/Impact';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import { Businesses, BusinessDetail, Chapters, Events, Members, Membership, Mentors, Opportunities, ProductsServices, Resources, SuccessStories } from './pages/NetworkPages';
import { MembershipApply, MentorRequestForm } from './pages/NetworkForms';

function NotFound(){return <div className="page-center"><div className="empty"><h2>Page not found</h2><p>The page you requested does not exist.</p><a className="button" href="/">Return home</a></div></div>}
export default function App(){return <Routes><Route element={<Layout/>}>
  <Route index element={<Home/>}/><Route path="about" element={<About/>}/><Route path="programs" element={<Programs/>}/>
  <Route path="current-needs" element={<CurrentNeeds/>}/><Route path="current-needs/:slug" element={<NeedDetail/>}/><Route path="campaigns" element={<Campaigns/>}/><Route path="campaigns/:slug" element={<CampaignDetail/>}/><Route path="sponsor-a-family" element={<SponsorFamilies/>}/><Route path="sponsor-a-family/:slug" element={<FamilyDetail/>}/><Route path="impact" element={<Impact/>}/>
  <Route path="membership" element={<Membership/>}/><Route path="membership/apply" element={<MembershipApply/>}/><Route path="members" element={<Members/>}/><Route path="mentors" element={<Mentors/>}/><Route path="mentor-request" element={<MentorRequestForm/>}/><Route path="businesses" element={<Businesses/>}/><Route path="businesses/:slug" element={<BusinessDetail/>}/><Route path="products-services" element={<ProductsServices/>}/><Route path="opportunities" element={<Opportunities/>}/><Route path="resources" element={<Resources/>}/><Route path="events" element={<Events/>}/><Route path="chapters" element={<Chapters/>}/><Route path="success-stories" element={<SuccessStories/>}/>
  <Route path="get-involved" element={<GetInvolved/>}/><Route path="donate" element={<Donate/>}/><Route path="donate-items" element={<DonateItems/>}/><Route path="shipment-tracking" element={<ShipmentTracking/>}/><Route path="request-assistance" element={<RequestAssistance/>}/><Route path="volunteer" element={<Volunteer/>}/><Route path="partners" element={<Partners/>}/><Route path="contact" element={<Contact/>}/><Route path="login" element={<Login/>}/><Route path="register" element={<Register/>}/><Route path="donation-success" element={<DonationSuccess/>}/>
  <Route element={<ProtectedRoute/>}><Route path="dashboard" element={<Dashboard/>}/><Route path="admin" element={<Admin/>}/></Route><Route path="*" element={<NotFound/>}/>
</Route></Routes>}
