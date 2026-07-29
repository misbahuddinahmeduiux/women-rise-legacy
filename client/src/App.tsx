import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import { About, GetInvolved, Programs } from './pages/StaticPages';
import { CampaignDetail, Campaigns, CurrentNeeds, FamilyDetail, NeedDetail, SponsorFamilies } from './pages/ListPages';
import { Contact, Donate, DonateItems, Partners, RequestAssistance, ShipmentTracking, Volunteer } from './pages/Forms';
import { ForgotPassword, Login, Register, ResetPassword } from './pages/AuthPages';
import Impact from './pages/Impact';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import { Businesses, BusinessDetail, Chapters, Events, Members, Mentors, Opportunities, ProductsServices, Resources, SuccessStories } from './pages/NetworkPages';
import Membership from './pages/Membership';
import MembershipSuccess from './pages/MembershipSuccess';
import MembershipReceipt from './pages/MembershipReceipt';
import MentorDashboard from './pages/MentorDashboard';
import { Podcast, PodcastDetail } from './pages/Podcast';
import { MembershipApply, MentorRequestForm } from './pages/NetworkForms';
import { DonationSuccess, Receipt } from './pages/Receipt';
import { Seo } from './components/Seo';
import { Loader } from './components/UI';
import { useAuth } from './contexts/AuthContext';

function WorkspaceRedirect() {
  const { profileLoading, defaultDashboardPath } = useAuth();
  if (profileLoading) return <div className="page-center"><Loader /></div>;
  return <Navigate to={defaultDashboardPath} replace />;
}

function NotFound() {
  return <div className="page-center"><Seo title="Page Not Found" description="The requested page could not be found." noIndex /><div className="empty"><h2>Page not found</h2><p>The page you requested does not exist.</p><a className="button" href="/">Return home</a></div></div>;
}

export default function App() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<Home />} /><Route path="about" element={<About />} /><Route path="programs" element={<Programs />} />
    <Route path="current-needs" element={<CurrentNeeds />} /><Route path="current-needs/:slug" element={<NeedDetail />} /><Route path="campaigns" element={<Campaigns />} /><Route path="campaigns/:slug" element={<CampaignDetail />} /><Route path="sponsor-a-family" element={<SponsorFamilies />} /><Route path="sponsor-a-family/:slug" element={<FamilyDetail />} /><Route path="impact" element={<Impact />} />
    <Route path="membership" element={<Membership />} /><Route path="membership-success" element={<MembershipSuccess />} /><Route path="membership-receipt/:token" element={<MembershipReceipt />} /><Route path="podcast" element={<Podcast />} /><Route path="podcast/:slug" element={<PodcastDetail />} /><Route path="membership/apply" element={<MembershipApply />} /><Route path="members" element={<Members />} /><Route path="mentors" element={<Mentors />} /><Route path="mentor-request" element={<MentorRequestForm />} /><Route path="businesses" element={<Businesses />} /><Route path="businesses/:slug" element={<BusinessDetail />} /><Route path="products-services" element={<ProductsServices />} /><Route path="opportunities" element={<Opportunities />} /><Route path="resources" element={<Resources />} /><Route path="events" element={<Events />} /><Route path="chapters" element={<Chapters />} /><Route path="success-stories" element={<SuccessStories />} />
    <Route path="get-involved" element={<GetInvolved />} /><Route path="donate" element={<Donate />} /><Route path="donate-items" element={<DonateItems />} /><Route path="shipment-tracking" element={<ShipmentTracking />} /><Route path="request-assistance" element={<RequestAssistance />} /><Route path="volunteer" element={<Volunteer />} /><Route path="partners" element={<Partners />} /><Route path="contact" element={<Contact />} /><Route path="login" element={<Login />} /><Route path="register" element={<Register />} /><Route path="forgot-password" element={<ForgotPassword />} /><Route path="reset-password" element={<ResetPassword />} /><Route path="donation-success" element={<DonationSuccess />} /><Route path="receipt/:token" element={<Receipt />} />

    <Route element={<ProtectedRoute />}>
      <Route path="workspace" element={<WorkspaceRedirect />} />
      <Route path="dashboard" element={<Dashboard />} />
    </Route>
    <Route element={<ProtectedRoute access="mentor" />}>
      <Route path="mentor-dashboard" element={<MentorDashboard />} />
    </Route>
    <Route element={<ProtectedRoute access="admin" />}>
      <Route path="admin" element={<Admin />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Route></Routes>;
}
