import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";

export function NotFound() {
  return (
    <EmptyState
      title="Pagina non trovata"
      description="Il link che hai aperto non esiste o è stato spostato."
      action={
        <Link to="/" className="button button-primary">
          Torna al feed
        </Link>
      }
    />
  );
}
