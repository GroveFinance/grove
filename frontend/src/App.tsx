import { AppSidebar } from "./components/app-sidebar"
import { ThemeProvider } from "./components/theme-provider"
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar"
import { Toaster } from "./components/ui/sonner"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import OverviewPage from "./pages/OverviewPage"
import InvestmentsPage from "./pages/InvestmentsPage"
import TransactionsPage from "./pages/TransactionsPage"
import SyncPage from "@/pages/settings/SyncPage"
import CategoriesPage from "@/pages/settings/CategoriesPage"
import RulesPage from "@/pages/settings/RulesPage"
import AccountsPage from "@/pages/settings/AccountsPage"
import RestaurantsPage from "@/pages/trends/RestaurantsPage"
import BudgetTrendsPage from "@/pages/trends/BudgetsPage"
import CategoryTrendsPage from "@/pages/trends/CategoriesPage"
import AppWrapper from "./components/appwrapper"


export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router basename={import.meta.env.BASE_URL}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppWrapper>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/investments" element={<InvestmentsPage />} />
                <Route path="/trends/restaurants" element={<RestaurantsPage />} />
                <Route path="/trends/budgets" element={<BudgetTrendsPage />} />
                <Route path="/trends/categories" element={<CategoryTrendsPage />} />
                <Route path="/settings/sync" element={<SyncPage />} />
                <Route path="/settings/rules" element={<RulesPage />}/>
                <Route path="/settings/categories" element={<CategoriesPage />} />
                <Route path="/settings/accounts" element={<AccountsPage />} />
              </Routes>
            </AppWrapper>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </Router>
    </ThemeProvider>
  )
}
