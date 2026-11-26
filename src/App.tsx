import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Protected } from "./components/ui";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import { Auth } from "./pages/Auth";
import { Favorites } from "./pages/Favorites";
import { Home } from "./pages/Home";
import { ItemDetail } from "./pages/ItemDetail";
import { NotFound } from "./pages/NotFound";
import { Offers } from "./pages/Offers";
import { Orders } from "./pages/Orders";
import { MyProfile, UserProfile } from "./pages/Profile";
import { Sell } from "./pages/Sell";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/annuncio/:id" element={<ItemDetail />} />
                <Route
                  path="/vendi"
                  element={
                    <Protected>
                      <Sell />
                    </Protected>
                  }
                />
                <Route
                  path="/preferiti"
                  element={
                    <Protected>
                      <Favorites />
                    </Protected>
                  }
                />
                <Route
                  path="/offerte"
                  element={
                    <Protected>
                      <Offers />
                    </Protected>
                  }
                />
                <Route
                  path="/ordini"
                  element={
                    <Protected>
                      <Orders />
                    </Protected>
                  }
                />
                <Route
                  path="/profilo"
                  element={
                    <Protected>
                      <MyProfile />
                    </Protected>
                  }
                />
                <Route path="/utente/:id" element={<UserProfile />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
