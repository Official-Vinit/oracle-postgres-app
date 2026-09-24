import axios from "axios";
import type {
  AiSchemaDesignResponse,
  CreatePostgresTablesResponse,
  HealthResponse,
  MetaDataResponse,
  PostgresTableMetadata,
  SelectedMetadataResponse,
  TablesMetadataResponse,
  TablesResponse,
} from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

export const getHealth = async (): Promise<HealthResponse> => {
  try {
    const response = await api.get<HealthResponse>("/health");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as HealthResponse;
    }
    throw error;
  }
};

export const getOracleTables = async (): Promise<TablesResponse> => {
  const response = await api.get<TablesResponse>("/oracle/tables");
  return response.data;
};

export const getPostgresTables = async (): Promise<TablesResponse> => {
  const response = await api.get<TablesResponse>("/postgres/tables");
  return response.data;
};

export const getPostgresTablesMetadata = async (): Promise<TablesMetadataResponse> => {
  const response = await api.get<TablesMetadataResponse>("/postgres/metadata");
  return response.data;
};

export const getOracleTableMetaData = async (
  table: string
): Promise<MetaDataResponse> => {
  const response = await api.get<MetaDataResponse>(`/oracle/tables/${encodeURIComponent(table)}`);
  return response.data;
};

export const getSelectedOracleMetadata = async (
  tables: string[]
): Promise<SelectedMetadataResponse> => {
  const response = await api.post<SelectedMetadataResponse>("/oracle/metadata", { tables });
  return response.data;
};

export const createPostgresTables = async (
  tables: PostgresTableMetadata[]
): Promise<CreatePostgresTablesResponse> => {
  const response = await api.post<CreatePostgresTablesResponse>("/postgres/tables", { tables });
  return response.data;
};

export const callSchemaDesign = async (
  selectedSchema: unknown,
  userQuery: string
): Promise<AiSchemaDesignResponse> => {
  const response = await api.post<AiSchemaDesignResponse>("/schema-design", {
    selected_schema: selectedSchema,
    current_design: null,
    user_query: userQuery,
  });
  return response.data;
};

export const applyAiSchema = async (
  aiResponse: AiSchemaDesignResponse
): Promise<CreatePostgresTablesResponse> => {
  const response = await api.post<CreatePostgresTablesResponse>("/postgres/apply-ai-schema", aiResponse);
  return response.data;
};
