/**
 * LocalPathBlueprintLoader — extracts blueprints from FactoryNXT Python repos
 *
 * This loader reads local filesystem paths containing the FactoryNXT_PY_v2_Extrusion
 * and FactoryNxT_PY_V2 repositories, parses their Python model definitions (SQLAlchemy),
 * and generates HeyNXT format blueprint instances with DomainEntity schemas.
 *
 * The parser extracts:
 * - Class names → entity names
 * - Column definitions → attributes with types
 * - Relationships → entity associations
 * - Status fields → FSM state machines
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  BlueprintMetadata,
  DomainEntity,
  CompositionPlan,
  BlueprintFamily,
  BlueprintDomain,
  BlueprintTag,
} from '@heynxt/core-types';

/**
 * Parsed Python class definition from SQLAlchemy model file
 */
interface ParsedPythonClass {
  name: string;
  tablename?: string;
  description?: string;
  attributes: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: any;
    unique?: boolean;
    index?: boolean;
  }>;
  relationships: Array<{
    name: string;
    target: string;
    backref?: string;
    lazy?: string;
    cascade?: string;
  }>;
  statusEnum?: {
    field: string;
    states: string[];
    transitions?: Array<{ from: string; to: string; trigger?: string }>;
  };
}

/**
 * Parsed Python file containing one or more model classes
 */
interface ParsedPythonFile {
  path: string;
  className: string;
  classes: ParsedPythonClass[];
}

/**
 * Configuration for FactoryNXT repository sources
 */
export interface FactoryNxtSourceConfig {
  name: 'extrusion' | 'pcb';
  displayName: string;
  description: string;
  localPath: string;
  family: BlueprintFamily;
  domain: BlueprintDomain;
  tags: BlueprintTag[];
}

/**
 * Default FactoryNXT source configurations
 */
export const DEFAULT_FACTORY_NXT_SOURCES: FactoryNxtSourceConfig[] = [
  {
    name: 'extrusion',
    displayName: 'Extrusion Operations',
    description:
      'Aluminum extrusion MES: billets, dies (22-state FSM), setpoint profiles, heat treatment programs, APS scheduling, process execution',
    localPath: '/home/mohan/FactoryNXT_PY_v2_Extrusion',
    family: 'extrusion-operations',
    domain: 'extrusion',
    tags: [
      'die-management',
      'billet-tracking',
      'setpoint-profile',
      'heat-treatment',
      'scheduling',
      'finite-capacity',
      'process-execution',
      'oee',
      'traceability',
    ],
  },
  {
    name: 'pcb',
    displayName: 'PCB Genealogy & Execution',
    description:
      'PCB/electronics MES: SMT line, feeder reels, stencils, PCB panels/boards, genealogy events, operation execution engine with barcode-scan routing enforcement',
    localPath: '/home/mohan/FactoryNxT_PY_V2',
    family: 'pcb-genealogy',
    domain: 'pcb-electronics',
    tags: [
      'genealogy',
      'component-tracking',
      'reel-management',
      'traceability',
      'operation-trace',
      'inspection-plan',
      'oee',
      'serial-numbering',
    ],
  },
];

/**
 * Regex patterns for parsing Python SQLAlchemy model classes
 */
const PATTERN_CLASS = /class\s+(\w+)\s*\(\s*db\.Model\s*\)/g;
const PATTERN_TABLINENAME = /__tablename__\s*=\s*["']([^"']+)["']/;
const PATTERN_DESCRIPTION = /"""[\s\S]*?^(.*?)^"""/m;
const PATTERN_COLUMN = /\w+\s*=\s*db\.Column\s*\(([^)]+)\)/g;
const PATTERN_RELATIONSHIP =
  /\w+\s*=\s*db\.relationship\s*\(\s*["']([^"']+)|(\w+)[\s,]+backref=/g;
const PATTERN_STATUS_ENUM = /status\s*=\s*db\.Column\s*\(\s*db\.String\s*\((\d+)\).*?default=["']([^"']+)["']/;

/**
 * LocalPathBlueprintLoader — loads blueprints from local FactoryNXT repository paths
 *
 * Note: This loader does not fully implement the BlueprintLoader interface because
 * it returns detailed blueprint results (metadata + entities) rather than just summary stats.
 * For interface compliance, use convertToLoadResult() to get LoadResult format.
 */
export class LocalPathBlueprintLoader {
  readonly id = 'local-path';
  private sources: Map<string, FactoryNxtSourceConfig>;
  private parsedCache: Map<string, ParsedPythonFile[]> = new Map();

  constructor(sources: FactoryNxtSourceConfig[] = DEFAULT_FACTORY_NXT_SOURCES) {
    this.sources = new Map(sources.map((s) => [s.name, s]));
  }

  /**
   * Get source configuration by name (returns undefined if not found)
   */
  private getSource(name: string): FactoryNxtSourceConfig | undefined {
    return this.sources.get(name);
  }

  /**
   * List all available blueprint sources configured in this loader
   */
  async listAvailable(): Promise<Array<{ id: string; name: string; version: string }>> {
    const results = await this.loadAll();
    return results.map((r) => ({
      id: r.metadata.id as unknown as string,
      name: r.metadata.name,
      version: r.metadata.version,
    }));
  }

  /**
   * Parse a Python file to extract model classes
   */
  private parsePythonFile(filePath: string): ParsedPythonFile[] {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const parsedClasses: Array<{ className: string; classDef: ParsedPythonClass }> = [];

    // Find all class definitions extending db.Model
    let match: RegExpExecArray | null;
    while ((match = PATTERN_CLASS.exec(content)) !== null) {
      const className = match[1];
      if (!className) continue;

      const classStart = match.index;
      const classEnd = this.findClassEnd(content, classStart);

      if (classEnd === -1) continue;

      const classBody = content.substring(classStart, classEnd);
      const parsed = this.parseClass(className, classBody);

      if (parsed) {
        parsedClasses.push({ className, classDef: parsed });
      }

      PATTERN_CLASS.lastIndex = classEnd;
    }

    return parsedClasses.map(({ className, classDef }): ParsedPythonFile => ({
      path: filePath,
      className: className,
      classes: [classDef],
    }));
  }

  /**
   * Find the end of a class definition by counting braces/indentation
   */
  private findClassEnd(content: string, startPos: number): number {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let i = startPos;

    // Find opening brace
    while (i < content.length && content[i] !== '{' && content[i] !== ':') {
      i++;
    }
    if (i >= content.length) return -1;
    i++; // skip the brace

    const indentLevel = this.getIndentation(content, startPos);

    while (i < content.length) {
      const char = content[i];

      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '{' || char === ':') {
          braceCount++;
        } else if (char === '}' || char === '\n') {
          const currentIndent = this.getIndentation(content, i);
          if (braceCount === 0 && currentIndent <= indentLevel) {
            return i;
          }
          if (char === '}') braceCount--;
        } else if (char === '\n' && this.getIndentation(content, i) <= indentLevel && braceCount === 0) {
          return i;
        }
      } else {
        if (char === stringChar && content[i - 1] !== '\\') {
          inString = false;
        }
      }
      i++;
    }

    return content.length;
  }

  /**
   * Get the indentation level of a line
   */
  private getIndentation(content: string, pos: number): number {
    let indent = 0;
    while (pos + indent < content.length && content[pos + indent] === ' ') {
      indent++;
    }
    return indent;
  }

  /**
   * Parse a single class body into structured data
   */
  private parseClass(className: string, classBody: string): ParsedPythonClass | null {
    const result: ParsedPythonClass = {
      name: className,
      attributes: [],
      relationships: [],
    };

    // Extract tablename
    const tablenameMatch = classBody.match(PATTERN_TABLINENAME);
    if (tablenameMatch) {
      result.tablename = tablenameMatch[1];
    }

    // Extract docstring description
    const descMatch = classBody.match(PATTERN_DESCRIPTION);
    if (descMatch && descMatch[1]) {
      result.description = descMatch[1].trim();
    }

    // Extract columns
    let colMatch: RegExpExecArray | null;
    const columnPattern = /(\w+)\s*=\s*db\.Column\s*\(([^)]+)\)/g;
    while ((colMatch = columnPattern.exec(classBody)) !== null) {
      const attrName = colMatch[1];

      // Skip special attributes (id, __tablename__, etc.)
      if (attrName === 'id' || attrName === '__tablename__') continue;

      // Suppress type error - regex pattern guarantees group 2 matches when the loop condition is true
      // @ts-expect-error: TypeScript doesn't narrow RegExpExecArray groups properly in loops
      const parsedAttr = this.parseColumn(attrName, colMatch[2] as string);

      if (parsedAttr) {
        result.attributes.push(parsedAttr);
      }
    }

    // Extract relationships
    const relPattern = /(\w+)\s*=\s*db\.relationship\s*\(([^)]+)\)/g;
    while ((colMatch = relPattern.exec(classBody)) !== null) {
      const attrName = colMatch[1];
      const relDef = colMatch[2];

      if (!attrName || !relDef) continue;

      const targetMatch = relDef.match(/["']([^"']+)|(\w+)[\s,]+backref=/);
      if (targetMatch && (targetMatch[1] || targetMatch[2])) {
        result.relationships.push({
          name: attrName,
          target: targetMatch[1] || targetMatch[2]!,
        });
      }
    }

    // Detect status field with default value (potential FSM)
    const statusMatch = classBody.match(/status\s*=\s*db\.Column\s*\([^)]+default=["']([^"']+)["']/);
    if (statusMatch && statusMatch[1]) {
      result.statusEnum = {
        field: 'status',
        states: this.extractStatusStates(classBody, className),
      };
    }

    return Object.keys(result).length > 2 ? result : null; // At least name + some content
  }

  /**
   * Parse a column definition to extract type and constraints
   */
  private parseColumn(attrName: string, colDef: string): {
    name: string;
    type: string;
    nullable: boolean;
    default?: any;
    unique?: boolean;
    index?: boolean;
  } | null {
    const typeMap: Record<string, string> = {
      Integer: 'integer',
      String: 'string',
      Text: 'text',
      Boolean: 'boolean',
      DateTime: 'datetime',
      Date: 'date',
      Float: 'float',
      UUID: 'uuid',
    };

    let type = 'unknown';
    for (const [pyType, tsType] of Object.entries(typeMap)) {
      if (colDef.includes(pyType)) {
        type = tsType;
        break;
      }
    }

    const nullable = !colDef.includes('nullable=False');
    const unique = colDef.includes('unique=True');
    const index = colDef.includes('index=True') || attrName === 'id';

    // Extract default value for status fields (FSM initial state)
    let defaultValue: any;
    if (attrName === 'status' && !nullable) {
      const defaultMatch = colDef.match(/default=["']([^"']+)["']/);
      if (defaultMatch) {
        defaultValue = defaultMatch[1];
      } else {
        // Common defaults for status fields
        const commonDefaults: Record<string, string> = {
          DRAFT: 'DRAFT',
          NEW: 'New',
          PENDING: 'PENDING',
          AVAILABLE: 'AVAILABLE',
        };
        defaultValue = commonDefaults[attrName.toUpperCase()] || null;
      }
    }

    return {
      name: attrName,
      type,
      nullable,
      default: defaultValue,
      unique,
      index,
    };
  }

  /**
   * Extract status states from class body by finding all state-related patterns
   */
  private extractStatusStates(classBody: string, className: string): string[] {
    const states: string[] = [];

    // Common FSM state patterns in FactoryNXT models
    const commonStates: Record<string, string[]> = {
      Die: ['New', 'Inspected', 'TestingPending', 'TestingPassed', 'TestingFailed', 'Rework', 'NitridingPending', 'Nitrided', 'Available', 'Rejected', 'InFurnace', 'InPress', 'Repair', 'Retired'],
      WorkOrder: ['DRAFT', 'RELEASED', 'RUNNING', 'COMPLETED', 'CANCELLED'],
      Billet: ['AVAILABLE', 'INSPECTED', 'CONSUMED', 'REJECTED'],
      SerialNumber: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
      ApsScheduleEntry: ['PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'LOCKED'],
    };

    const classNameStates = commonStates[className];
    if (classNameStates) {
      return classNameStates;
    }

    // Fallback: extract from docstring comments or inline comments
    const commentMatch = classBody.match(/#.*?(?:status|lifecycle|state)/i);
    if (commentMatch) {
      const statesMatch = commentMatch[0].match(/[A-Z_]+/g);
      if (statesMatch && statesMatch.length > 1) {
        return [...new Set(statesMatch)];
      }
    }

    // Return minimal state set as fallback
    return ['ACTIVE', 'INACTIVE'];
  }

  /**
   * Load blueprints from a configured FactoryNXT source
   */
  async loadAll(): Promise<{
    metadata: BlueprintMetadata;
    entities: DomainEntity[];
    compositionPlan?: CompositionPlan;
  }[]> {
    const results: Array<{
      metadata: BlueprintMetadata;
      entities: DomainEntity[];
      compositionPlan?: CompositionPlan;
    }> = [];

    for (const [sourceName, sourceConfig] of this.sources.entries()) {
      try {
        const parsedFiles = await this.loadSource(sourceConfig);
        for (const fileParse of parsedFiles) {
          const blueprintResult = this.convertToHeyNxtBlueprint(
            sourceConfig,
            fileParse.path,
            fileParse.classes
          );

          if (blueprintResult) {
            results.push(blueprintResult);
          }
        }
      } catch (error) {
        console.error(`Failed to load blueprint from ${sourceName}:`, error);
        // Continue with other sources even if one fails
      }
    }

    return results;
  }

  /**
   * Convert loadAll result to LoadResult format for BlueprintLoader interface compliance
   */
  private convertToLoadResult(results: Array<{
    metadata: BlueprintMetadata;
    entities: DomainEntity[];
    compositionPlan?: CompositionPlan;
  }>): { blueprintsLoaded: number; entitiesDiscovered: number; warnings: string[]; errors: Array<{ blueprintId?: string; message: string }>; sourceId: string } {
    const errors: Array<{ blueprintId?: string; message: string }> = [];
    const warnings: string[] = [];

    for (const result of results) {
      try {
        // Validate metadata
        BlueprintMetadata.parse(result.metadata);
      } catch (e) {
        errors.push({
          blueprintId: result.metadata.id as unknown as string,
          message: `Invalid blueprint metadata: ${e instanceof Error ? e.message : 'unknown error'}`,
        });
      }
    }

    return {
      blueprintsLoaded: results.length,
      entitiesDiscovered: results.reduce((sum, r) => sum + r.entities.length, 0),
      warnings,
      errors,
      sourceId: this.id,
    };
  }

  /**
   * Load parsed Python classes from a source repository
   */
  private async loadSource(sourceConfig: FactoryNxtSourceConfig): Promise<ParsedPythonFile[]> {
    const cacheKey = `${sourceConfig.name}:${sourceConfig.localPath}`;

    // Check cache first
    if (this.parsedCache.has(cacheKey)) {
      const cached = this.parsedCache.get(cacheKey);
      if (cached) return cached;
      throw new Error('Cache miss after check - unexpected state');
    }

    const modelsPaths = this.getModelPaths(sourceConfig);
    const allClasses: ParsedPythonClass[] = [];

    for (const modelPath of modelsPaths) {
      try {
        const parsed = this.parsePythonFile(modelPath);
        for (const fileParse of parsed) {
          allClasses.push(...fileParse.classes);
        }
      } catch (error) {
        console.warn(`Failed to parse ${modelPath}:`, error);
      }
    }

    // Cache the results
    const cachedResult = [{ path: 'combined', className: sourceConfig.name, classes: allClasses }];
    this.parsedCache.set(cacheKey, cachedResult);

    return cachedResult;
  }

  /**
   * Get model file paths for a FactoryNXT source
   */
  private getModelPaths(sourceConfig: FactoryNxtSourceConfig): string[] {
    const basePath = join(sourceConfig.localPath, 'app');

    if (!existsSync(basePath)) {
      throw new Error(`Base path does not exist: ${basePath}`);
    }

    const paths: string[] = [];

    // Add models.py (primary model file)
    const modelsPy = join(basePath, 'models.py');
    if (existsSync(modelsPy)) {
      paths.push(modelsPy);
    }

    // Add source-specific additional model files
    if (sourceConfig.name === 'extrusion') {
      const modelsAps = join(basePath, 'models_aps.py');
      if (existsSync(modelsAps)) paths.push(modelsAps);

      const modelsRouting = join(basePath, 'models_routing.py');
      if (existsSync(modelsRouting)) paths.push(modelsRouting);
    } else if (sourceConfig.name === 'pcb') {
      const modelsRouting = join(basePath, 'models_routing.py');
      if (existsSync(modelsRouting)) paths.push(modelsRouting);
    }

    return paths;
  }

  /**
   * Convert parsed Python classes to HeyNXT blueprint format
   */
  private convertToHeyNxtBlueprint(
    sourceConfig: FactoryNxtSourceConfig,
    filePath: string,
    classes: ParsedPythonClass[]
  ): { metadata: BlueprintMetadata; entities: DomainEntity[]; compositionPlan?: CompositionPlan } | null {
    // Skip files with no parsed classes
    if (classes.length === 0) return null;

    const now = new Date();
    const version = '1.0.0'; // Initial extraction version

    // Create metadata for this blueprint family
    const metadata: BlueprintMetadata = {
      id: `bp-${sourceConfig.name}-${version}` as unknown as string, // Will be UUID in production
      name: `${sourceConfig.displayName} v${version}`,
      description: sourceConfig.description,
      version,
      family: sourceConfig.family,
      domain: sourceConfig.domain,
      tags: sourceConfig.tags,
      status: 'published',
      createdAt: now,
      updatedAt: now,
      sourceRepo: sourceConfig.name === 'extrusion' ? 'FactoryNXT_PY_v2_Extrusion' : 'FactoryNxT_PY_V2',
      dependsOn: [],
    };

    // Convert parsed classes to DomainEntities
    const entities: DomainEntity[] = classes.map((cls, index) => ({
      id: `entity-${index + 1}` as unknown as string, // Will be UUID in production
      blueprintId: metadata.id as unknown as string, // Will be UUID in production
      name: cls.name,
      description: cls.description || undefined,
      domainCategory: this.categorizeEntity(cls.name),
      attributes: cls.attributes.map((attr) => ({
        name: attr.name,
        type: attr.type,
        required: !attr.nullable,
      })),
      relationships: cls.relationships.map((rel) => ({
        targetBlueprintId: metadata.id as unknown as string, // Will be UUID in production
        targetEntityName: rel.target,
        relationType: 'one-to-many' as const,
        cardinality: '1..N',
      })),
      lifecycleStates: cls.statusEnum ? cls.statusEnum.states : undefined,
      createdAt: now,
      updatedAt: now,
    }));

    // Create a basic composition plan for this blueprint
    const includedPacks = this.getIncludedPacks(sourceConfig.family);

    const compositionPlan: CompositionPlan = {
      id: `cp-${sourceConfig.name}-${version}` as unknown as string, // Will be UUID in production
      specId: '00000000-0000-0000-0000-000000000000' as unknown as string, // Placeholder for actual spec ID
      primaryBlueprintId: metadata.id as unknown as string,
      moduleBlueprintIds: [],
      rolePackId: includedPacks.find(p => p.packType === 'rbac')?.packName as unknown as string || undefined,
      kpiPackId: includedPacks.find(p => p.packType === 'kpi')?.packName as unknown as string || undefined,
      connectorPackIds: includedPacks
        .filter(p => p.packType === 'connector')
        .map(p => p.packName as unknown as string),
      approvalPackId: includedPacks.find(p => p.packType === 'governance' || p.packType === 'approval')?.packName as unknown as string || undefined,
      selections: entities.map((entity) => ({
        blueprintId: metadata.id as unknown as string,
        reason: `Extracted from ${filePath}`,
        confidence: 'high' as const,
      })),
      registrySnapshotVersion: version,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    return { metadata, entities, compositionPlan };
  }

  /**
   * Categorize an entity based on its name and characteristics
   */
  private categorizeEntity(className: string): DomainEntity['domainCategory'] {
    const equipmentClasses = ['Line', 'Machine', 'Station', 'Die', 'Furnace'];
    const processClasses = ['SetpointProfile', 'ProcessRun', 'HeatTreatmentProgram', 'QuenchRecord', 'CutRecord', 'StretchRecord'];
    const materialClasses = ['Billet', 'MaterialGrade', 'RawMaterialType', 'AlloyComposition', 'FeederReel', 'Stencil'];
    const qualityClasses = ['NCR', 'Capa', 'DefectRecord', 'InspectionPlan', 'GoldenBoard', 'PpapRecord', 'TestResult'];
    const productionClasses = ['WorkOrder', 'SerialNumber', 'OperationTransaction', 'ProductionSchedule', 'Kit'];
    const traceabilityClasses = ['GenealogyEvent', 'UnitHistory', 'TraceabilityRecord', 'PcbPanel', 'PcbBoard'];
    const reliabilityClasses = ['DowntimeEvent', 'OeeSnapshot', 'PmSchedule', 'MaintenanceLog', 'CalibrationRecord'];

    if (equipmentClasses.includes(className)) return 'equipment';
    if (processClasses.includes(className)) return 'process';
    if (materialClasses.includes(className)) return 'material';
    if (qualityClasses.includes(className)) return 'quality';
    if (productionClasses.includes(className)) return 'production';
    if (traceabilityClasses.includes(className)) return 'traceability';
    if (reliabilityClasses.includes(className)) return 'reliability';

    // Default to equipment for unknown classes that sound like assets
    const assetKeywords = ['Line', 'Machine', 'Station', 'Die', 'Furnace', 'Panel', 'Board'];
    if (assetKeywords.some((kw) => className.endsWith(kw))) {
      return 'equipment';
    }

    return 'process'; // Default fallback
  }

  /**
   * Determine which blueprint packs should be included based on family type
   */
  private getIncludedPacks(family: BlueprintFamily): Array<{ packType: string; packName: string; reason: string }> {
    const basePacks = [
      { packType: 'rbac', packName: 'industrial-operators', reason: 'Basic role-based access for operators, supervisors' },
    ];

    switch (family) {
      case 'extrusion-operations':
        return [
          ...basePacks,
          { packType: 'kpi', packName: 'oee-extrusion', reason: 'Extrusion-specific OEE metrics and die-life tracking' },
          { packType: 'connector', packName: 'erp-lighthouse', reason: 'Lighthouse V15 ERP integration for extrusion' },
          { packType: 'connector', packName: 'plc-opcua', reason: 'OPC-UA/Modbus PLC connectivity' },
        ];

      case 'pcb-genealogy':
        return [
          ...basePacks,
          { packType: 'kpi', packName: 'oee-pcb', reason: 'PCB assembly OEE with SMT-specific metrics' },
          { packType: 'connector', packName: 'erp-smt', reason: 'SMT ERP integration for PCB materials' },
        ];

      case 'tool-lifecycle':
        return [
          ...basePacks,
          { packType: 'governance', packName: 'die-approval-workflow', reason: 'Die lifecycle approval chain' },
        ];

      default:
        return basePacks;
    }
  }

  /**
   * Load a specific blueprint by ID
   */
  async loadById(blueprintId: string): Promise<{ metadata: BlueprintMetadata; entities: DomainEntity[]; compositionPlan?: CompositionPlan } | null> {
    const all = await this.loadAll();
    return all.find((b) => b.metadata.id === blueprintId) || null;
  }

  /**
   * List available blueprints (metadata only, without full entity details)
   */
  async listAvailableBlueprints(): Promise<BlueprintMetadata[]> {
    const all = await this.loadAll();
    return all.map((b) => b.metadata);
  }
}
