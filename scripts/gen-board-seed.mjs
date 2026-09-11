#!/usr/bin/env node
/**
 * Emits supabase/seed_board.sql: 20 extra tasks per team plus attachments.
 * Run: node scripts/gen-board-seed.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const P = {
  gally: "a0000000-0000-0000-0000-000000000001",
  naty: "a0000000-0000-0000-0000-000000000002",
  deybid: "a0000000-0000-0000-0000-000000000003",
  roy: "a0000000-0000-0000-0000-000000000004",
  susana: "a0000000-0000-0000-0000-000000000005",
  amanda: "a0000000-0000-0000-0000-000000000006",
  nathan: "a0000000-0000-0000-0000-000000000007",
  fernanda: "a0000000-0000-0000-0000-000000000008",
  jenny: "a0000000-0000-0000-0000-000000000009",
  angie: "a0000000-0000-0000-0000-00000000000a",
  jhonny: "a0000000-0000-0000-0000-00000000000b",
  david: "a0000000-0000-0000-0000-00000000000c",
};

const T = {
  comercial: "b0000000-0000-0000-0000-000000000001",
  operaciones: "b0000000-0000-0000-0000-000000000002",
  usa: "b0000000-0000-0000-0000-000000000003",
  academia: "b0000000-0000-0000-0000-000000000004",
  marketing: "b0000000-0000-0000-0000-000000000005",
  administracion: "b0000000-0000-0000-0000-000000000006",
  regenerativo: "b0000000-0000-0000-0000-000000000007",
  direccion: "b0000000-0000-0000-0000-000000000008",
};

function tid(teamKey, n) {
  const prefix = {
    comercial: "e1",
    operaciones: "e2",
    usa: "e3",
    academia: "e4",
    marketing: "e5",
    administracion: "e6",
    regenerativo: "e7",
    direccion: "e8",
  }[teamKey];
  return `${prefix}000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function fid(teamKey, n) {
  const prefix = {
    comercial: "f1",
    operaciones: "f2",
    usa: "f3",
    academia: "f4",
    marketing: "f5",
    administracion: "f6",
    regenerativo: "f7",
    direccion: "f8",
  }[teamKey];
  return `${prefix}000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function aid(teamKey, n) {
  const prefix = {
    comercial: "aa1",
    operaciones: "aa2",
    usa: "aa3",
    academia: "aa4",
    marketing: "aa5",
    administracion: "aa6",
    regenerativo: "aa7",
    direccion: "aa8",
  }[teamKey];
  return `${prefix}00000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function sqlStr(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** @typedef {{ title: string, notes: string, area: string | null, owner: string, assignee: string, due: number | null, priority: string, status: string, createdBy?: string, file?: { filename: string, mime: string, bytes: number } }} TaskDef */

/** @type {Record<string, TaskDef[]>} */
const teams = {
  comercial: [
    { title: "Cotización Punta Islita 25 kg", notes: "Especialidad lavado, entrega en Nicoya.", area: "cotizaciones", owner: P.deybid, assignee: P.nathan, due: -4, priority: "urgent", status: "open", file: { filename: "Cotizacion Punta Islita 25kg.pdf", mime: "application/pdf", bytes: 18432 } },
    { title: "Ruta Heredia y Alajuela", notes: "Visitas B2B y reposición de muestras.", area: "ruta", owner: P.deybid, assignee: P.nathan, due: 1, priority: "high", status: "open" },
    { title: "Seguimiento tostadora Café Britt", notes: "Volumen estimado 60 kg al mes.", area: "pipeline", owner: P.deybid, assignee: P.deybid, due: 5, priority: "medium", status: "in_progress" },
    { title: "Propuesta volumen Automercado", notes: "Probar 40 kg de blend casa.", area: "pipeline", owner: P.deybid, assignee: P.nathan, due: 8, priority: "high", status: "open" },
    { title: "Renovar contrato Café Kalú", notes: "Ajuste de precio y calendario de entregas.", area: "pipeline", owner: P.deybid, assignee: P.deybid, due: 0, priority: "high", status: "open", file: { filename: "Contrato Cafe Kalu 2026.pdf", mime: "application/pdf", bytes: 42100 } },
    { title: "Visita hotel Andaz Papagayo", notes: "Cupping en barra y propuesta de menú.", area: "ruta", owner: P.deybid, assignee: P.roy, due: 3, priority: "medium", status: "open" },
    { title: "Cotización Restaurante Silvestre 15 kg", notes: "Lavado y honey, dos perfiles.", area: "cotizaciones", owner: P.deybid, assignee: P.nathan, due: 2, priority: "medium", status: "open", file: { filename: "Cotizacion Silvestre 15kg.pdf", mime: "application/pdf", bytes: 15200 } },
    { title: "Pipeline Q4 cuentas nuevas", notes: "Lista priorizada de 12 cuentas CR.", area: "pipeline", owner: P.deybid, assignee: P.deybid, due: 14, priority: "high", status: "open" },
    { title: "Muestras para Grupo Gastronómico", notes: "Cinco bolsas de 250 g con fichas.", area: "pipeline", owner: P.deybid, assignee: P.naty, due: 4, priority: "low", status: "open" },
    { title: "Seguimiento pedido Hotel Nayara", notes: "Confirmar fecha de primer despacho.", area: "pipeline", owner: P.deybid, assignee: P.nathan, due: -1, priority: "urgent", status: "open" },
    { title: "Ruta San José centro miércoles", notes: "Seis paradas, salir 7:30.", area: "ruta", owner: P.deybid, assignee: P.nathan, due: 6, priority: "medium", status: "open" },
    { title: "Cotización corporativo BAC 50 kg", notes: "Blend oficina, factura mensual.", area: "cotizaciones", owner: P.deybid, assignee: P.deybid, due: 9, priority: "high", status: "open" },
    { title: "Cierre cuenta Café de la Suerte", notes: "Pendiente firma y primer pedido.", area: "pipeline", owner: P.deybid, assignee: P.nathan, due: 11, priority: "medium", status: "open" },
    { title: "Actualizar lista de precios B2B", notes: "Q4 especialidad vs comercial.", area: "cotizaciones", owner: P.deybid, assignee: P.deybid, due: 7, priority: "high", status: "in_progress", file: { filename: "Lista precios B2B Q4.csv", mime: "text/csv", bytes: 4096 } },
    { title: "Visita cliente Cartago jueves", notes: "Llevar geisha y honey.", area: "ruta", owner: P.deybid, assignee: P.roy, due: 12, priority: "low", status: "open" },
    { title: "Propuesta suscripción oficinas WeWork", notes: "Entrega semanal 8 kg.", area: "pipeline", owner: P.deybid, assignee: P.naty, due: 15, priority: "medium", status: "open" },
    { title: "Seguimiento Lost Coast Coffee", notes: "Interés en micro-lotes CR.", area: "pipeline", owner: P.deybid, assignee: P.deybid, due: 18, priority: "low", status: "open" },
    { title: "Ruta Guanacaste fin de mes", notes: "Tamarindo, Nosara y Playas del Coco.", area: "ruta", owner: P.deybid, assignee: P.nathan, due: 20, priority: "medium", status: "open" },
    { title: "Cotización catering boda 8 kg", notes: "Evento en Santa Ana, tueste medio.", area: "cotizaciones", owner: P.deybid, assignee: P.naty, due: 3, priority: "low", status: "done" },
    { title: "Revisar descuentos mayoristas", notes: "Tope 12 % salvo Dirección.", area: "pipeline", owner: P.deybid, assignee: P.deybid, due: 21, priority: "medium", status: "open" },
  ],
  operaciones: [
    { title: "Tueste lote Brumas 240 kg", notes: "Perfil espresso casa, desarrollo 18 %.", area: "tueste", owner: P.roy, assignee: P.angie, due: -2, priority: "high", status: "in_progress", file: { filename: "Perfil tueste Brumas 240.pdf", mime: "application/pdf", bytes: 28672 } },
    { title: "Conteo verde bodega 2", notes: "Sacos y big bags, cruzar con sistema.", area: "bodega", owner: P.roy, assignee: P.jhonny, due: 0, priority: "high", status: "open" },
    { title: "Pedido válvulas tostadora", notes: "Repuesto Giesen, lead time 10 días.", area: "pedidos", owner: P.roy, assignee: P.roy, due: 4, priority: "medium", status: "open" },
    { title: "Envío a Limón jueves", notes: "Confirmar transporte y guía.", area: "envíos", owner: P.roy, assignee: P.jhonny, due: 2, priority: "high", status: "open" },
    { title: "Cupping lote Santa María", notes: "Mesa interna, anotar defectos.", area: "calidad", owner: P.roy, assignee: P.angie, due: 1, priority: "medium", status: "open" },
    { title: "Empaque micro-lote geisha", notes: "Bolsas 150 g con válvula.", area: "bodega", owner: P.roy, assignee: P.jhonny, due: 5, priority: "medium", status: "open" },
    { title: "Mantenimiento despedidora", notes: "Limpieza y ajuste de mallas.", area: "tueste", owner: P.roy, assignee: P.roy, due: 10, priority: "low", status: "open" },
    { title: "Control humedad silo 3", notes: "Meta 10.5–11.5 %.", area: "calidad", owner: P.roy, assignee: P.angie, due: 3, priority: "high", status: "open", file: { filename: "Humedad silo 3.csv", mime: "text/csv", bytes: 2048 } },
    { title: "Pedido bolsas 250 g kraft", notes: "3 000 unidades, logo actual.", area: "pedidos", owner: P.roy, assignee: P.susana, due: 6, priority: "medium", status: "open" },
    { title: "Preparar envío especialidad a USA", notes: "Pallet 1, lotes 2408 y 2409.", area: "envíos", owner: P.roy, assignee: P.jhonny, due: 8, priority: "urgent", status: "open" },
    { title: "Perfil tueste honey Los Robles", notes: "Probar curva más corta.", area: "tueste", owner: P.roy, assignee: P.angie, due: 7, priority: "high", status: "open" },
    { title: "Reposición empaque compostable", notes: "Cruzar con pedido de Amanda.", area: "pedidos", owner: P.roy, assignee: P.nathan, due: 9, priority: "medium", status: "open" },
    { title: "Inventario empaque y cintas", notes: "Incluir cajas y etiquetas.", area: "bodega", owner: P.roy, assignee: P.jhonny, due: 11, priority: "low", status: "open" },
    { title: "Envío CoopeDota", notes: "Verde de intercambio, 20 sacos.", area: "envíos", owner: P.roy, assignee: P.jhonny, due: 13, priority: "medium", status: "open" },
    { title: "Análisis defectos lote 2410", notes: "Quaker y fermento.", area: "calidad", owner: P.roy, assignee: P.angie, due: -3, priority: "urgent", status: "open", file: { filename: "Defectos lote 2410.csv", mime: "text/csv", bytes: 3072 } },
    { title: "Programar tueste semanal", notes: "Espresso, filtro y USA.", area: "tueste", owner: P.roy, assignee: P.roy, due: 1, priority: "high", status: "open" },
    { title: "Pedido nitrógeno para empaque", notes: "Cilindro de respaldo.", area: "pedidos", owner: P.roy, assignee: P.deybid, due: 16, priority: "low", status: "open" },
    { title: "Limpieza silos y tolvas", notes: "Paro de 4 horas el sábado.", area: "bodega", owner: P.roy, assignee: P.jhonny, due: 18, priority: "low", status: "open" },
    { title: "Envío muestras SCA", notes: "Tres perfiles, 300 g cada uno.", area: "envíos", owner: P.roy, assignee: P.naty, due: 4, priority: "medium", status: "done" },
    { title: "Calibrar medidor de humedad", notes: "Patrón de 11 %.", area: "calidad", owner: P.roy, assignee: P.angie, due: 14, priority: "medium", status: "in_progress" },
  ],
  usa: [
    { title: "Inventario Tennessee estantes A-C", notes: "Cruce con exportes pendientes.", area: null, owner: P.roy, assignee: P.roy, due: -1, priority: "high", status: "open", file: { filename: "Inventario TN estantes A-C.csv", mime: "text/csv", bytes: 8192 } },
    { title: "Booking contenedor octubre", notes: "Puerto Limón, ETA Nashville.", area: null, owner: P.roy, assignee: P.deybid, due: 12, priority: "urgent", status: "open" },
    { title: "Seguimiento Intelligentsia", notes: "Muestras de geisha enviadas en agosto.", area: null, owner: P.roy, assignee: P.roy, due: 5, priority: "high", status: "open" },
    { title: "Etiquetas FDA lote export", notes: "Lot code y origen en inglés.", area: null, owner: P.roy, assignee: P.naty, due: 3, priority: "high", status: "open", file: { filename: "Etiqueta FDA lote export.pdf", mime: "application/pdf", bytes: 51200 } },
    { title: "Receiving warehouse semana 37", notes: "Confirmar pallets y daños.", area: null, owner: P.roy, assignee: P.roy, due: 0, priority: "medium", status: "open" },
    { title: "Quote for Onyx Coffee Lab", notes: "Two 30 kg boxes, washed Caturra.", area: null, owner: P.roy, assignee: P.deybid, due: 6, priority: "high", status: "open" },
    { title: "Actualizar landed cost USA", notes: "Flete, seguro y warehouse.", area: null, owner: P.roy, assignee: P.deybid, due: 8, priority: "medium", status: "in_progress" },
    { title: "Programa de muestras US Q4", notes: "Lista de 15 tostadores.", area: null, owner: P.roy, assignee: P.naty, due: 10, priority: "low", status: "open" },
    { title: "Revisar stock 12 oz bags TN", notes: "Reordenar si baja de 200.", area: null, owner: P.roy, assignee: P.roy, due: 2, priority: "high", status: "open" },
    { title: "Documentos fitosanitarios septiembre", notes: "SFE y packing list.", area: null, owner: P.roy, assignee: P.naty, due: 7, priority: "urgent", status: "open", file: { filename: "Packing list septiembre.pdf", mime: "application/pdf", bytes: 24576 } },
    { title: "Llamada distributor Nashville", notes: "Reorden y nuevos SKU.", area: null, owner: P.roy, assignee: P.roy, due: 4, priority: "medium", status: "open" },
    { title: "Plan de precios US 2026", notes: "Alinear con Dirección.", area: null, owner: P.roy, assignee: P.deybid, due: 21, priority: "high", status: "open" },
    { title: "Reposición Tennessee desde CR", notes: "Priorizar espresso blend.", area: null, owner: P.roy, assignee: P.roy, due: 14, priority: "medium", status: "open" },
    { title: "Cliente Houndstooth reorder", notes: "Austin, 40 kg honey.", area: null, owner: P.roy, assignee: P.deybid, due: 9, priority: "medium", status: "open" },
    { title: "Auditoría humedad warehouse", notes: "Higrómetros de los tres cuartos.", area: null, owner: P.roy, assignee: P.roy, due: 11, priority: "low", status: "open" },
    { title: "Contrato distributor Texas", notes: "Exclusividad por condado.", area: null, owner: P.roy, assignee: P.deybid, due: 18, priority: "high", status: "open" },
    { title: "Etiquetado lot codes US", notes: "Imprimir rollos para octubre.", area: null, owner: P.roy, assignee: P.naty, due: 1, priority: "medium", status: "open" },
    { title: "Envío aéreo muestras SCA Expo", notes: "Chicago, 12 bolsas.", area: null, owner: P.roy, assignee: P.roy, due: 16, priority: "high", status: "open" },
    { title: "Forecast ventas USA Q4", notes: "Kg por cliente y por SKU.", area: null, owner: P.roy, assignee: P.deybid, due: 20, priority: "medium", status: "in_progress", file: { filename: "Forecast USA Q4.csv", mime: "text/csv", bytes: 6144 } },
    { title: "Resolver claim contenedor dañado", notes: "Fotos y reclamo al seguro.", area: null, owner: P.roy, assignee: P.roy, due: -5, priority: "urgent", status: "open" },
  ],
  academia: [
    { title: "Taller barista Heredia", notes: "12 cupos, aula y material.", area: "talleres", owner: P.fernanda, assignee: P.fernanda, due: 9, priority: "high", status: "open", file: { filename: "Programa taller Heredia.pdf", mime: "application/pdf", bytes: 33792 } },
    { title: "Confirmar cupos curso latte art", notes: "Mínimo 8 para abrir.", area: "talleres", owner: P.fernanda, assignee: P.naty, due: 2, priority: "medium", status: "open" },
    { title: "Evento cupping abierto octubre", notes: "Lista de invitados y catación.", area: "eventos", owner: P.fernanda, assignee: P.fernanda, due: 22, priority: "medium", status: "open" },
    { title: "Material didáctico nivel 1", notes: "Actualizar fichas de tueste.", area: "talleres", owner: P.fernanda, assignee: P.jenny, due: 6, priority: "medium", status: "in_progress", file: { filename: "Fichas tueste nivel 1.pdf", mime: "application/pdf", bytes: 90112 } },
    { title: "Alquiler aula San Pedro", notes: "Confirmar fecha y depósito.", area: "talleres", owner: P.fernanda, assignee: P.fernanda, due: 4, priority: "high", status: "open" },
    { title: "Workshop finca Brumas", notes: "Transporte y almuerzo.", area: "eventos", owner: P.fernanda, assignee: P.deybid, due: 18, priority: "low", status: "open" },
    { title: "Certificación SCA intro", notes: "Inscribir a Roy y Angie.", area: "talleres", owner: P.fernanda, assignee: P.fernanda, due: 12, priority: "high", status: "open" },
    { title: "Fotos para brochure academia", notes: "Barra y aula, luz de mañana.", area: "eventos", owner: P.fernanda, assignee: P.jenny, due: 5, priority: "medium", status: "open" },
    { title: "Calendario talleres Q4", notes: "Publicar en web y WhatsApp.", area: "talleres", owner: P.fernanda, assignee: P.naty, due: 1, priority: "high", status: "open", file: { filename: "Calendario talleres Q4.csv", mime: "text/csv", bytes: 1536 } },
    { title: "Compra de leches vegetales", notes: "Avena y soya para prácticas.", area: "talleres", owner: P.fernanda, assignee: P.fernanda, due: 3, priority: "low", status: "open" },
    { title: "Evento pairing chocolate", notes: "Alianza con productor de Talamanca.", area: "eventos", owner: P.fernanda, assignee: P.fernanda, due: 28, priority: "low", status: "open" },
    { title: "Actualizar lista de espera", notes: "Llamar a 9 personas.", area: "talleres", owner: P.fernanda, assignee: P.naty, due: 0, priority: "medium", status: "open" },
    { title: "Kit de catación para cursos", notes: "Cucharas, vasos y formularios.", area: "talleres", owner: P.fernanda, assignee: P.deybid, due: 8, priority: "medium", status: "open" },
    { title: "Charla en UCR gastronomía", notes: "Fecha tentativa 15 de octubre.", area: "eventos", owner: P.fernanda, assignee: P.fernanda, due: 16, priority: "medium", status: "open" },
    { title: "Reparar molino de aula", notes: "Muelas y calibración.", area: "talleres", owner: P.fernanda, assignee: P.jenny, due: -2, priority: "urgent", status: "open" },
    { title: "Encuesta pos-taller agosto", notes: "Resumir notas y NPS.", area: "talleres", owner: P.fernanda, assignee: P.naty, due: -6, priority: "low", status: "done" },
    { title: "Alianza hotel para events", notes: "Espacio y coffee break.", area: "eventos", owner: P.fernanda, assignee: P.deybid, due: 19, priority: "low", status: "open" },
    { title: "Imprimir diplomas septiembre", notes: "18 nombres, firma de Fernanda.", area: "talleres", owner: P.fernanda, assignee: P.jenny, due: 7, priority: "medium", status: "open" },
    { title: "Demo espresso en feria", notes: "Máquina, molino y 6 kg.", area: "eventos", owner: P.fernanda, assignee: P.fernanda, due: 11, priority: "high", status: "open" },
    { title: "Revisar precios de cursos 2026", notes: "Alinear con Administración.", area: "talleres", owner: P.fernanda, assignee: P.fernanda, due: 24, priority: "medium", status: "open" },
  ],
  marketing: [
    { title: "Diseño etiqueta micro-lote geisha", notes: "Cosecha 2026, fondo verde.", area: "diseño", owner: P.jenny, assignee: P.jenny, due: 7, priority: "high", status: "in_progress", file: { filename: "Borrador etiqueta geisha.png", mime: "image/png", bytes: 98304 } },
    { title: "Carrusel Instagram beneficio", notes: "Cinco fotos de proceso.", area: "redes", owner: P.jenny, assignee: P.jenny, due: 2, priority: "medium", status: "open" },
    { title: "Ficha técnica blend casa", notes: "PDF para vendedores.", area: "materiales", owner: P.jenny, assignee: P.jenny, due: 5, priority: "high", status: "open", file: { filename: "Ficha tecnica blend casa.pdf", mime: "application/pdf", bytes: 45056 } },
    { title: "Reels cosecha Tarrazú", notes: "Clip de 20 s, subtítulos ES/EN.", area: "redes", owner: P.jenny, assignee: P.fernanda, due: 4, priority: "medium", status: "open" },
    { title: "Actualizar manual de marca", notes: "Nuevo verde y tipografía.", area: "diseño", owner: P.jenny, assignee: P.jenny, due: 14, priority: "medium", status: "open" },
    { title: "Menús para academia", notes: "Tres tamaños, impresión local.", area: "materiales", owner: P.jenny, assignee: P.fernanda, due: 8, priority: "low", status: "open" },
    { title: "Campaña LinkedIn B2B", notes: "Cuatro piezas para Deybid.", area: "redes", owner: P.jenny, assignee: P.deybid, due: 9, priority: "medium", status: "open" },
    { title: "Fotos de empaque compostable", notes: "Fondo crema, luz natural.", area: "diseño", owner: P.jenny, assignee: P.jenny, due: 3, priority: "high", status: "open", file: { filename: "Empaque compostable.jpg", mime: "image/jpeg", bytes: 120000 } },
    { title: "Calendario de contenidos octubre", notes: "Tres posts por semana.", area: "redes", owner: P.jenny, assignee: P.naty, due: 11, priority: "medium", status: "open" },
    { title: "Banner feria SCA", notes: "Roll-up 85 × 200 cm.", area: "materiales", owner: P.jenny, assignee: P.jenny, due: 16, priority: "high", status: "open" },
    { title: "Stickers para ruta comercial", notes: "500 unidades, logo chico.", area: "materiales", owner: P.jenny, assignee: P.deybid, due: 6, priority: "low", status: "open" },
    { title: "Rediseño etiqueta 1 kg mayorista", notes: "Más espacio para lote.", area: "diseño", owner: P.jenny, assignee: P.jenny, due: 13, priority: "medium", status: "open" },
    { title: "Stories visita a finca", notes: "Amanda manda clips el viernes.", area: "redes", owner: P.jenny, assignee: P.fernanda, due: 1, priority: "medium", status: "open" },
    { title: "Hoja de cata para clientes", notes: "Imprimible A5.", area: "materiales", owner: P.jenny, assignee: P.jenny, due: 10, priority: "low", status: "open" },
    { title: "Ajuste logo para bordado", notes: "Versión de un color.", area: "diseño", owner: P.jenny, assignee: P.jenny, due: 18, priority: "low", status: "open" },
    { title: "Publicar recap taller barista", notes: "Fotos y cita de una alumna.", area: "redes", owner: P.jenny, assignee: P.naty, due: 0, priority: "medium", status: "open" },
    { title: "Kit de prensa para USA", notes: "One-pager EN + fotos.", area: "materiales", owner: P.jenny, assignee: P.deybid, due: 20, priority: "high", status: "open", file: { filename: "One-pager USA.pdf", mime: "application/pdf", bytes: 77824 } },
    { title: "Retoque fotos cupping SCA", notes: "Color y recorte cuadrado.", area: "diseño", owner: P.jenny, assignee: P.jenny, due: -3, priority: "urgent", status: "open" },
    { title: "Newsletter cosecha septiembre", notes: "Texto corto, una foto, un CTA.", area: "redes", owner: P.jenny, assignee: P.naty, due: 15, priority: "low", status: "done" },
    { title: "Mockup bolsa 250 g nueva", notes: "Tres fondos para aprobación.", area: "diseño", owner: P.jenny, assignee: P.jenny, due: 22, priority: "medium", status: "open" },
  ],
  administracion: [
    { title: "Cobro factura 1901", notes: "Cliente 32 días vencido.", area: "cobros", owner: P.susana, assignee: P.susana, due: -6, priority: "urgent", status: "open", file: { filename: "Factura 1901.pdf", mime: "application/pdf", bytes: 22000 } },
    { title: "Facturación mayorista septiembre", notes: "Cierre y XML.", area: "facturación", owner: P.susana, assignee: P.susana, due: 0, priority: "high", status: "in_progress" },
    { title: "Cuadrar inventario oficina", notes: "Cruzar con bodega de Jhonny.", area: "oficina", owner: P.susana, assignee: P.susana, due: 11, priority: "low", status: "open" },
    { title: "Pago proveedores tueste", notes: "Giesen service y gas.", area: "oficina", owner: P.susana, assignee: P.susana, due: 2, priority: "high", status: "open" },
    { title: "Conciliación banco septiembre", notes: "Tres cuentas, exportar CSV.", area: "oficina", owner: P.susana, assignee: P.susana, due: 5, priority: "high", status: "open", file: { filename: "Conciliacion septiembre.csv", mime: "text/csv", bytes: 9216 } },
    { title: "Cobro Hotel Nayara", notes: "Factura 1888, recordar por correo.", area: "cobros", owner: P.susana, assignee: P.naty, due: 1, priority: "medium", status: "open" },
    { title: "Timbrado de facturas octubre", notes: "Saldo de numeración Hacienda.", area: "facturación", owner: P.susana, assignee: P.susana, due: 8, priority: "medium", status: "open" },
    { title: "Renovar póliza de bodega", notes: "Enviar inventario actualizado.", area: "oficina", owner: P.susana, assignee: P.deybid, due: 16, priority: "medium", status: "open" },
    { title: "Cobro Café Don Juan", notes: "Plan de tres cuotas.", area: "cobros", owner: P.susana, assignee: P.susana, due: -2, priority: "high", status: "open" },
    { title: "Cierre de caja academia", notes: "Cursos de agosto.", area: "facturación", owner: P.susana, assignee: P.susana, due: 3, priority: "medium", status: "open" },
    { title: "Orden de papelería", notes: "Toner, sobres y folders.", area: "oficina", owner: P.susana, assignee: P.naty, due: 9, priority: "low", status: "open" },
    { title: "Declaración IVA setiembre", notes: "Revisar créditos fiscales.", area: "facturación", owner: P.susana, assignee: P.susana, due: 12, priority: "urgent", status: "open" },
    { title: "Seguimiento nota de crédito 44", notes: "Cliente devolvió 8 kg.", area: "cobros", owner: P.susana, assignee: P.deybid, due: 4, priority: "medium", status: "open" },
    { title: "Actualizar proveedores en sistema", notes: "Datos bancarios y cédulas.", area: "oficina", owner: P.susana, assignee: P.susana, due: 14, priority: "low", status: "open" },
    { title: "Pago planilla quincena", notes: "Confirmar horas extra de tueste.", area: "oficina", owner: P.susana, assignee: P.susana, due: 6, priority: "high", status: "open" },
    { title: "Facturas de exportación USA", notes: "Inglés, Incoterms FCA.", area: "facturación", owner: P.susana, assignee: P.susana, due: 7, priority: "high", status: "open", file: { filename: "Factura export USA.pdf", mime: "application/pdf", bytes: 19456 } },
    { title: "Auditoría interna de cobros", notes: "Antigüedad de saldo a 60+.", area: "cobros", owner: P.susana, assignee: P.deybid, due: 18, priority: "medium", status: "open" },
    { title: "Renovar dominio y correo", notes: "buenavida.cr, vence en 40 días.", area: "oficina", owner: P.susana, assignee: P.naty, due: 21, priority: "low", status: "open" },
    { title: "Cierre facturación agosto tardío", notes: "Ya enviado a contador.", area: "facturación", owner: P.susana, assignee: P.susana, due: -10, priority: "medium", status: "done" },
    { title: "Revisar gastos de ruta", notes: "Combustible y peajes de Nathan.", area: "oficina", owner: P.susana, assignee: P.susana, due: 13, priority: "low", status: "open" },
  ],
  regenerativo: [
    { title: "Documentos auditoría regenerativa", notes: "Carpeta compartida y checklist.", area: null, owner: P.amanda, assignee: P.amanda, due: 12, priority: "high", status: "in_progress", file: { filename: "Checklist auditoria regenerativa.pdf", mime: "application/pdf", bytes: 38912 } },
    { title: "Visita finca La Amistad", notes: "Suelos y sombra, fotos.", area: null, owner: P.amanda, assignee: P.amanda, due: 6, priority: "high", status: "open" },
    { title: "Análisis de suelo Finca Sonora", notes: "Enviar laboratorio y archivo.", area: null, owner: P.amanda, assignee: P.amanda, due: 3, priority: "medium", status: "open", file: { filename: "Analisis suelo Finca Sonora.pdf", mime: "application/pdf", bytes: 55296 } },
    { title: "Alianza cooperativa de mujeres", notes: "Borrador de compra 2026.", area: null, owner: P.amanda, assignee: P.amanda, due: 16, priority: "medium", status: "open" },
    { title: "Registro de trazabilidad Q3", notes: "Lote, finca, proceso, taza.", area: null, owner: P.amanda, assignee: P.naty, due: 4, priority: "high", status: "open", file: { filename: "Trazabilidad Q3.csv", mime: "text/csv", bytes: 7168 } },
    { title: "Taller compost en beneficio", notes: "Fecha con el equipo de finca.", area: null, owner: P.amanda, assignee: P.amanda, due: 20, priority: "low", status: "open" },
    { title: "Renovación sello 2026", notes: "Pago y formularios.", area: null, owner: P.amanda, assignee: P.amanda, due: 28, priority: "urgent", status: "open" },
    { title: "Mapa de fincas aliadas", notes: "KML y notas de altitud.", area: null, owner: P.amanda, assignee: P.naty, due: 9, priority: "medium", status: "open" },
    { title: "Entrevista productor Los Robles", notes: "Para historia de etiqueta.", area: null, owner: P.amanda, assignee: P.amanda, due: 8, priority: "low", status: "open" },
    { title: "Indicadores de impacto 2026", notes: "Agua, sombra y ingresos.", area: null, owner: P.amanda, assignee: P.amanda, due: 22, priority: "medium", status: "open" },
    { title: "Muestras de mieles de proceso", notes: "Tres fincas, 200 g cada una.", area: null, owner: P.amanda, assignee: P.amanda, due: 1, priority: "medium", status: "open" },
    { title: "Reunión con Rainforest Alliance", notes: "Alcance vs sello propio.", area: null, owner: P.amanda, assignee: P.naty, due: 14, priority: "low", status: "open" },
    { title: "Plan de sombra Finca Brumas", notes: "Especies y densidad.", area: null, owner: P.amanda, assignee: P.amanda, due: 18, priority: "medium", status: "open" },
    { title: "Fotos de biodiversidad", notes: "Aves y árboles, para marketing.", area: null, owner: P.amanda, assignee: P.amanda, due: 5, priority: "low", status: "open" },
    { title: "Informe de visita agosto", notes: "Tres fincas, una página cada una.", area: null, owner: P.amanda, assignee: P.amanda, due: -4, priority: "high", status: "open" },
    { title: "Acuerdo de compra La Amistad", notes: "Volumen y precio piso.", area: null, owner: P.amanda, assignee: P.amanda, due: 25, priority: "high", status: "open", file: { filename: "Borrador acuerdo La Amistad.pdf", mime: "application/pdf", bytes: 27648 } },
    { title: "Capacitación de catación en finca", notes: "Llevar kit y formularios.", area: null, owner: P.amanda, assignee: P.naty, due: 11, priority: "low", status: "open" },
    { title: "Actualizar página de impacto", notes: "Cifras 2025 y fotos nuevas.", area: null, owner: P.amanda, assignee: P.amanda, due: 15, priority: "medium", status: "open" },
    { title: "Envío de suelos a laboratorio", notes: "Ya entregado el martes.", area: null, owner: P.amanda, assignee: P.amanda, due: -8, priority: "medium", status: "done" },
    { title: "Calendario de visitas Q4", notes: "Seis fincas, una por quincena.", area: null, owner: P.amanda, assignee: P.amanda, due: 7, priority: "medium", status: "open" },
  ],
  direccion: [
    { title: "Agenda junta septiembre", notes: "Precios, USA y certificación.", area: null, owner: P.gally, assignee: P.naty, due: 2, priority: "high", status: "open", file: { filename: "Agenda junta septiembre.pdf", mime: "application/pdf", bytes: 12288 } },
    { title: "Revisión márgenes Q3", notes: "Especialidad vs comercial.", area: null, owner: P.gally, assignee: P.deybid, due: 5, priority: "high", status: "in_progress" },
    { title: "Borrador partnership SCA", notes: "Cláusulas de marca y eventos.", area: null, owner: P.gally, assignee: P.roy, due: 14, priority: "medium", status: "open" },
    { title: "Comentarios memo inversionistas", notes: "Segunda ronda de notas.", area: null, owner: P.gally, assignee: P.david, due: 6, priority: "high", status: "open", file: { filename: "Memo inversionistas v2.pdf", mime: "application/pdf", bytes: 65536 } },
    { title: "Plan de contratación 2026", notes: "¿Suma alguien en USA?", area: null, owner: P.gally, assignee: P.gally, due: 20, priority: "medium", status: "open" },
    { title: "Reunión precios con Deybid", notes: "Tope de descuento mayorista.", area: null, owner: P.gally, assignee: P.deybid, due: 1, priority: "urgent", status: "open" },
    { title: "Carta a fincas aliadas", notes: "Volumen 2026 y fechas de pago.", area: null, owner: P.gally, assignee: P.naty, due: 9, priority: "medium", status: "open" },
    { title: "Revisión term sheet", notes: "Notas de David sobre dilución.", area: null, owner: P.gally, assignee: P.david, due: 11, priority: "high", status: "open" },
    { title: "Objetivos OKR Q4", notes: "Comercial, USA y regenerativo.", area: null, owner: P.gally, assignee: P.gally, due: 4, priority: "high", status: "open" },
    { title: "Alianza hotel Nayara grupo", notes: "Más propiedades, un contrato.", area: null, owner: P.gally, assignee: P.deybid, due: 16, priority: "medium", status: "open" },
    { title: "Presupuesto de marketing 2026", notes: "Tope y prioridades con Jenny.", area: null, owner: P.gally, assignee: P.naty, due: 18, priority: "low", status: "open" },
    { title: "Decisión tostadora segunda", notes: "Capacidad vs capex.", area: null, owner: P.gally, assignee: P.roy, due: 24, priority: "medium", status: "open" },
    { title: "Resumen semanal para junta", notes: "Una página, hechos no prosa.", area: null, owner: P.gally, assignee: P.naty, due: 0, priority: "medium", status: "open" },
    { title: "Política de visibilidad invitados", notes: "Documentar el carve-out de David.", area: null, owner: P.gally, assignee: P.gally, due: 13, priority: "low", status: "open" },
    { title: "Revisión de tesis USA", notes: "¿Distribuidor o warehouse propio?", area: null, owner: P.gally, assignee: P.roy, due: 8, priority: "high", status: "open" },
    { title: "Calendario de viajes Q4", notes: "SCA, Tennessee y fincas.", area: null, owner: P.gally, assignee: P.naty, due: 7, priority: "low", status: "open" },
    { title: "Aprobación de precios Q4", notes: "Lista B2B y USA.", area: null, owner: P.gally, assignee: P.gally, due: 3, priority: "urgent", status: "open", file: { filename: "Precios Q4 para aprobar.csv", mime: "text/csv", bytes: 3584 } },
    { title: "Notas de llamada con inversionista", notes: "Seguimiento a 10 días.", area: null, owner: P.gally, assignee: P.deybid, due: -3, priority: "high", status: "open" },
    { title: "Cierre de acuerdos agosto", notes: "Archivado en Dirección.", area: null, owner: P.gally, assignee: P.naty, due: -12, priority: "low", status: "done" },
    { title: "Definir sponsor de academia", notes: "¿Fernanda reporta formalmente a Deybid?", area: null, owner: P.gally, assignee: P.gally, due: 22, priority: "low", status: "open" },
  ],
};

for (const [key, list] of Object.entries(teams)) {
  if (list.length < 20) {
    throw new Error(`${key} has ${list.length} tasks, need 20`);
  }
}

function emitTask(teamKey, def, n) {
  const id = tid(teamKey, n);
  const teamId = T[teamKey];
  const createdBy = def.createdBy ?? def.owner;
  const dueExpr = def.due == null ? "null" : `today + (${def.due})`;
  const completed = def.status === "done" ? "now() - interval '2 days'" : "null";
  return `    (
      '${id}',
      ${sqlStr(def.title)},
      ${sqlStr(def.notes)},
      '${teamId}',
      ${sqlStr(def.area)},
      '${def.owner}',
      '${def.assignee}',
      ${dueExpr},
      '${def.priority}',
      '${def.status}',
      'team',
      '${createdBy}',
      ${completed}
    )`;
}

function emitFile(teamKey, def, n, fileIndex) {
  const taskId = tid(teamKey, n);
  const teamId = T[teamKey];
  const attId = fid(teamKey, fileIndex);
  const storageId = aid(teamKey, fileIndex);
  const path = `${teamId}/${taskId}/${storageId}-${def.file.filename}`;
  return `    (
      '${attId}',
      '${taskId}',
      ${sqlStr(path)},
      ${sqlStr(def.file.filename)},
      ${sqlStr(def.file.mime)},
      ${def.file.bytes},
      '${def.owner}'
    )`;
}

const taskRows = [];
const fileRows = [];
for (const [teamKey, list] of Object.entries(teams)) {
  list.forEach((def, i) => {
    const n = i + 1;
    taskRows.push(emitTask(teamKey, def, n));
    if (def.file) fileRows.push(emitFile(teamKey, def, n, fileRows.length + 1));
  });
}

function slugName(title) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 70);
}

function autoFile(title, n) {
  const lower = title.toLowerCase();
  let ext = "pdf";
  let mime = "application/pdf";
  if (/foto|imagen|etiqueta|empaque|mockup|reel|carrusel/.test(lower)) {
    ext = n % 2 === 0 ? "png" : "jpg";
    mime = ext === "png" ? "image/png" : "image/jpeg";
  } else if (/inventario|lista|precios|forecast|humedad|trazabilidad|conciliacion/.test(lower)) {
    ext = "csv";
    mime = "text/csv";
  } else if (n % 4 === 2) {
    ext = "csv";
    mime = "text/csv";
  } else if (n % 4 === 3) {
    ext = "png";
    mime = "image/png";
  }
  return { filename: `${slugName(title)}.${ext}`, mime, bytes: 8192 + n * 80 };
}

for (const [teamKey, list] of Object.entries(teams)) {
  list.forEach((def, i) => {
    if (def.file) return;
    def.file = autoFile(def.title, i + 1);
    fileRows.push(emitFile(teamKey, def, i + 1, fileRows.length + 1));
  });
}

const sql = `-- Extra board data: 20 tasks per team (160) plus attachments.
-- Applied after seed.sql. Idempotent. Not used as the P0 25-task fixture by itself.

do $$
declare
  today date := (timezone('America/Costa_Rica', now()))::date;
begin
  insert into public.tasks (
    id, title, notes, team_id, area, owner_id, assignee_id,
    due_date, priority, status, visibility, created_by, completed_at
  )
  values
${taskRows.join(",\n")}
  on conflict (id) do nothing;

  insert into public.attachments (
    id, task_id, storage_path, filename, mime_type, size_bytes, uploaded_by
  )
  values
${fileRows.join(",\n")}
  on conflict (id) do nothing;

  insert into public.task_events (task_id, actor_id, kind, diff, source)
  select id, created_by, 'created', jsonb_build_object('title', title), 'ui'
  from public.tasks
  where not exists (
    select 1 from public.task_events e where e.task_id = tasks.id and e.kind = 'created'
  );
end $$;
`;

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "seed_board.sql");
writeFileSync(out, sql);
console.log(`Wrote ${out}`);
console.log(`Tasks: ${taskRows.length}, attachments: ${fileRows.length}`);
