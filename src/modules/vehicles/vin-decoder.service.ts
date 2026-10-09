import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vin } from './entities/vin.entity';

/** WMI (первые 2–3 символа) → марка. Покрывает основной парк КР/СНГ, включая китайские сборки. */
const WMI: Record<string, string> = {
  // Япония
  JT: 'Toyota',
  JTH: 'Lexus',
  JTJ: 'Lexus',
  JN: 'Nissan',
  JN1: 'Nissan',
  JNK: 'Infiniti',
  JH: 'Honda',
  JHM: 'Honda',
  JHL: 'Honda',
  JM: 'Mazda',
  JF: 'Subaru',
  JA: 'Mitsubishi',
  JMB: 'Mitsubishi',
  JS: 'Suzuki',
  JD: 'Daihatsu',
  JL: 'Mitsubishi Fuso',
  JAL: 'Isuzu',
  // Корея
  KM: 'Hyundai',
  KMH: 'Hyundai',
  KNA: 'Kia',
  KND: 'Kia',
  KNM: 'Renault Samsung',
  KL: 'Daewoo/Chevrolet',
  KPT: 'SsangYong',
  KMJ: 'Hyundai',
  // Европа
  WBA: 'BMW',
  WBS: 'BMW M',
  WBX: 'BMW',
  WDB: 'Mercedes-Benz',
  WDD: 'Mercedes-Benz',
  WDC: 'Mercedes-Benz',
  W1K: 'Mercedes-Benz',
  W1N: 'Mercedes-Benz',
  WVW: 'Volkswagen',
  WV1: 'Volkswagen',
  WV2: 'Volkswagen',
  WVG: 'Volkswagen',
  WAU: 'Audi',
  WA1: 'Audi',
  WP0: 'Porsche',
  WP1: 'Porsche',
  W0L: 'Opel',
  WF0: 'Ford',
  VF1: 'Renault',
  VF3: 'Peugeot',
  VF7: 'Citroen',
  VSS: 'SEAT',
  TMB: 'Skoda',
  YV1: 'Volvo',
  YV4: 'Volvo',
  SAL: 'Land Rover',
  SAJ: 'Jaguar',
  ZFA: 'Fiat',
  ZAR: 'Alfa Romeo',
  VSK: 'Nissan',
  TRU: 'Audi',
  // СНГ
  XTA: 'Lada',
  XTT: 'UAZ',
  X96: 'GAZ',
  XW8: 'Volkswagen',
  X4X: 'BMW',
  Z94: 'Hyundai',
  XWE: 'Kia',
  XUF: 'Chevrolet',
  XTC: 'KAMAZ',
  Y6D: 'ZAZ',
  XW7: 'Toyota',
  Z8N: 'Nissan',
  XUU: 'Chevrolet',
  // Китай
  LSV: 'Volkswagen (SAIC)',
  LFV: 'Volkswagen (FAW)',
  LVS: 'Ford (Changan)',
  LVV: 'Chery',
  LGW: 'Great Wall/Haval',
  LB3: 'Geely',
  LGX: 'BYD',
  LC0: 'BYD',
  LS5: 'Changan',
  LVH: 'Honda (Dongfeng)',
  LHG: 'Honda (GAC)',
  LTV: 'Toyota (FAW)',
  LFM: 'Toyota (FAW)',
  LVG: 'Toyota (GAC)',
  LBV: 'BMW (Brilliance)',
  LE4: 'Mercedes-Benz (Beijing)',
  LDC: 'Dongfeng',
  LZW: 'Wuling',
  LSG: 'Chevrolet/Buick (SAIC-GM)',
  LSJ: 'MG (SAIC)',
  LNB: 'BAIC',
  LMG: 'GAC Trumpchi',
  LJ1: 'JAC',
  LUR: 'Chery (Jetour)',
  LNP: 'Li Auto',
  L6T: 'Geely',
  LFP: 'FAW',
  LGB: 'Nissan (Dongfeng)',
  LRW: 'Tesla (Shanghai)',
  LWV: 'Changan',
  LKL: 'Hongqi',
  LVR: 'Changan Mazda',
  HJR: 'Exeed/Chery',
  LDP: 'Voyah',
  LYV: 'Volvo (China)',
  LPS: 'Polestar',
  LNN: 'Chery',
  LJV: 'JAC',
  // США
  '1FA': 'Ford',
  '1FT': 'Ford',
  '1FM': 'Ford',
  '1G1': 'Chevrolet',
  '1GC': 'Chevrolet',
  '1GN': 'Chevrolet',
  '1HG': 'Honda',
  '1N4': 'Nissan',
  '2T1': 'Toyota',
  '4T1': 'Toyota',
  '5YJ': 'Tesla',
  '5UX': 'BMW',
  '1C4': 'Jeep/Chrysler',
  '1J4': 'Jeep',
  '2HG': 'Honda',
  '3VW': 'Volkswagen',
  '5NP': 'Hyundai',
  '5XY': 'Kia',
  '4S3': 'Subaru',
  '4S4': 'Subaru',
  JTD: 'Toyota',
  JTE: 'Toyota',
  JTM: 'Toyota',
  JTN: 'Toyota',
};

const COUNTRY_BY_FIRST: Record<string, string> = {
  J: 'Japan',
  K: 'South Korea',
  L: 'China',
  H: 'China',
  W: 'Germany',
  V: 'France/Spain',
  Z: 'Italy',
  S: 'United Kingdom',
  T: 'Czechia/Switzerland',
  Y: 'Sweden/Finland',
  X: 'Russia/CIS',
  '1': 'USA',
  '4': 'USA',
  '5': 'USA',
  '2': 'Canada',
  '3': 'Mexico',
};

const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

export interface VinDecodeResult {
  vin: string;
  valid: boolean;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  engine: string | null;
  transmission: string | null;
  drive: string | null;
  bodyType: string | null;
  country: string | null;
  source: string;
  /** false — VIN не распознан, предложите клиенту ручной ввод */
  recognized: boolean;
}

@Injectable()
export class VinDecoderService {
  private readonly logger = new Logger(VinDecoderService.name);

  constructor(
    @InjectRepository(Vin) private readonly vins: Repository<Vin>,
    private readonly config: ConfigService,
  ) {}

  static isValid(vin: string): boolean {
    return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());
  }

  /** Год по 10-му символу (цикл 30 лет — берём самый поздний, не больше текущего+1) */
  static yearFromVin(vin: string): number | null {
    const idx = YEAR_CODES.indexOf(vin[9]);
    if (idx < 0) return null;
    const maxYear = new Date().getFullYear() + 1;
    let year = 1980 + idx;
    while (year + 30 <= maxYear) year += 30;
    return year;
  }

  static decodeLocal(vinRaw: string): VinDecodeResult {
    const vin = vinRaw.toUpperCase();
    const valid = VinDecoderService.isValid(vin);
    const make = WMI[vin.slice(0, 3)] ?? WMI[vin.slice(0, 2)] ?? null;
    return {
      vin,
      valid,
      make,
      model: null,
      year: valid ? VinDecoderService.yearFromVin(vin) : null,
      trim: null,
      engine: null,
      transmission: null,
      drive: null,
      bodyType: null,
      country: COUNTRY_BY_FIRST[vin[0]] ?? null,
      source: 'local',
      recognized: !!make,
    };
  }

  /** Бесплатный NHTSA vPIC: хорошо для США/Кореи/части Европы, слабо для JDM/Китая */
  private async decodeNhtsa(
    vin: string,
  ): Promise<(Partial<VinDecodeResult> & { raw?: Record<string, unknown> }) | null> {
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { Results?: Record<string, string>[] };
      const r = body.Results?.[0];
      if (!r || !r.Make) return null;
      const engineParts = [
        r.DisplacementL && `${Number(r.DisplacementL).toFixed(1)}L`,
        r.EngineModel,
        r.FuelTypePrimary,
      ]
        .filter(Boolean)
        .join(' ');
      return {
        make: titleCase(r.Make),
        model: r.Model || null,
        year: r.ModelYear ? Number(r.ModelYear) : null,
        trim: r.Trim || r.Series || null,
        engine: engineParts || null,
        transmission: r.TransmissionStyle || null,
        drive: r.DriveType || null,
        bodyType: r.BodyClass || null,
        raw: r,
      };
    } catch (e) {
      this.logger.warn(`NHTSA decode failed for ${vin}: ${(e as Error).message}`);
      return null;
    }
  }

  async decode(vinRaw: string): Promise<VinDecodeResult> {
    const vin = vinRaw.toUpperCase().trim();
    const cached = await this.vins.findOneBy({ vin });
    if (cached) return { ...cached, valid: true, recognized: !!cached.make };

    const local = VinDecoderService.decodeLocal(vin);
    if (!local.valid) return local;

    let result: VinDecodeResult = local;
    let raw: Record<string, unknown> | null = null;
    if (this.config.get<boolean>('VIN_DECODER_EXTERNAL')) {
      const ext = await this.decodeNhtsa(vin);
      if (ext) {
        raw = ext.raw ?? null;
        result = {
          ...local,
          ...Object.fromEntries(Object.entries(ext).filter(([k, v]) => v && k !== 'raw')),
          source: 'nhtsa',
          recognized: true,
        } as VinDecodeResult;
      }
    }

    if (result.recognized) {
      const { valid, recognized, ...data } = result;
      void valid;
      void recognized;
      await this.vins.save(this.vins.create({ ...data, raw }));
    }
    return result;
  }

  /** Ручная корректировка VIN (клиент ввёл марку/модель сам) — сохраняем как manual, если раньше не было */
  async saveManual(vin: string, data: Partial<Vin>) {
    const exists = await this.vins.findOneBy({ vin });
    if (exists) return exists;
    return this.vins.save(this.vins.create({ ...data, vin, source: 'manual' }));
  }
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
