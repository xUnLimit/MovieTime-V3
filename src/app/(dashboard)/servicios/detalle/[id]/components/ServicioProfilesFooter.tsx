import { Button } from "@/components/ui/button";

interface ServicioProfilesFooterProps {
  isServicioActivo: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  profilePage: number;
  profilePageCount: number;
  showProfileControls: boolean;
}

export function ServicioProfilesFooter({
  isServicioActivo,
  onNextPage,
  onPreviousPage,
  profilePage,
  profilePageCount,
  showProfileControls,
}: ServicioProfilesFooterProps) {
  return (
    <div className="mt-2 flex min-w-0 flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600"></div>
          <span className="text-muted-foreground">En uso</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600"></div>
          <span className="text-muted-foreground">Disponible</span>
        </div>
        {!isServicioActivo && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-600"></div>
            <span className="text-muted-foreground">Inactivo</span>
          </div>
        )}
      </div>
      {showProfileControls ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <span className="whitespace-nowrap text-muted-foreground mr-2">
            Pagina {Math.min(profilePage + 1, profilePageCount)} de {profilePageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={onPreviousPage}
            disabled={profilePage === 0}
          >
            Anterior
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={onNextPage}
            disabled={profilePage >= profilePageCount - 1}
          >
            Siguiente
          </Button>
        </div>
      ) : (
        <span className="text-muted-foreground" />
      )}
    </div>
  );
}
