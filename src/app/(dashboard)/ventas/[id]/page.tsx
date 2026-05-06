import VentaDetalleClient from './VentaDetalleClient';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VentaDetallePage({ params }: PageProps) {
  const { id } = await params;
  return <VentaDetalleClient id={id} />;
}
