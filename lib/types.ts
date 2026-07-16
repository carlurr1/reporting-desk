// ─── Tipos del dominio Reporting Desk ────────────────────────────
export type Rol = "analista" | "coordinador" | "superadmin" | "consulta";

export type EstadoInforme =
  | "pendiente"
  | "programado"
  | "enviado_parcial"
  | "enviado"
  | "enviado_posventa"
  | "sin_programacion";

export type Frecuencia = "Mensual" | "Semanal" | "N/A";
export type AreaEmite = "Reporting" | "InformesHdp" | "Posventa";

export interface Usuario {
  id: string;
  login: string;
  iniciales: string | null;
  nombre: string;
  apellido: string | null;
  rol: Rol;
  cargo: string | null;
  area: string | null;
  email_real: string | null;
  bloqueado: boolean;
  activo: boolean;
}

export interface Cliente {
  id: string;
  sf_account_id: string | null;
  nit: string | null;
  nombre: string;
  segmento: string | null;
  subsegmento: string | null;
  cliente_valor: string | null;
  esquema_atencion: string | null;
  tipo_cliente: string | null;
  ejecutivo_experiencia: string | null;
  ingeniero_posventa: string | null;
  supervisor: string | null;
  ans: string | null;
  activo: boolean;
}

export interface Programacion {
  id: string;
  cliente_id: string;
  tipo_informe: string | null;
  frecuencia: Frecuencia;
  semana_emision: number | null;
  area_emite: string | null;
  analista_id: string | null;
  aliado_id: string | null;
  activo: boolean;
  notas: string | null;
}

export interface Informe {
  id: string;
  programacion_id: string | null;
  cliente_id: string;
  periodo: string;            // 'YYYY-MM-01'
  semana_emision: number | null;
  tipo_informe: string | null;
  area_emite: string | null;
  analista_id: string | null;
  estado: EstadoInforme;
  fecha_envio: string | null;
  informacion_pendiente: string | null;
  caso_sf: string | null;
  sf_cliente: string | null;
  sf_estado: string | null;
  sf_validado: boolean;
  sf_consultado_at: string | null;
  registrado_por: string | null;
}

// Fila del tablero de productividad (vista v_productividad_analista).
export interface MetricaAnalista {
  periodo: string;
  analista_id: string;
  iniciales: string;
  nombre: string;
  apellido: string;
  total: number;
  enviados: number;
  programados: number;
  pendientes: number;
  parciales: number;
  con_caso: number;
  casos_validados: number;
  pct_cumplimiento: number;
}

export interface ResumenPeriodo {
  total: number;
  enviados: number;
  programados: number;
  pendientes: number;
  parciales: number;
  casos_validados: number;
  pct_cumplimiento: number;
}
