import { Axios, AxiosResponse } from "axios";
import {
  AzurePipelineInfo,
  AzurePipelineKey,
  AzurePipelineDefinition,
  AzurePipelineRunResult,
  AzureListResult,
  BuildQueryParams,
  TimelineResult,
} from "./pipeline.types";
import { AzureRepositoryKey } from "./repository.types";
import { AzureRepoService } from "./repository";

export class AzurePipelineService {
  constructor(private axios: Axios, private repoService?: AzureRepoService) {}

  async list({
    organization,
    project,
  }: Pick<AzurePipelineKey, "organization" | "project">) {
    return this.axios.get<
      any,
      AxiosResponse<AzureListResult<AzurePipelineInfo>>
    >(`https://dev.azure.com/${organization}/${project}/_apis/pipelines`);
  }
  async getByRepoName({
    organization,
    project,
    repository,
  }: AzureRepositoryKey) {
    const result = await this.list({ organization, project });
    return result.data.value?.find((pipe) => pipe.name === repository);
  }
  async create({ organization, project, repository }: AzureRepositoryKey) {
    const repositoryResponse = await this.repoService?.info({
      organization,
      project,
      repository,
    });
    const repositoryInfo = repositoryResponse?.data;
    if (!repositoryInfo) return undefined;

    const payload = {
      variables: "",
      triggers: [
        {
          branchFilters: [],
          pathFilters: [],
          settingsSourceType: 2,
          batchChanges: true,
          maxConcurrentBuildsPerBranch: 1,
          triggerType: "continuousIntegration",
        },
      ],
      retentionRules: [
        {
          branches: ["+refs/heads/*", "+refs/tags/*"],
          daysToKeep: 10,
          minimumToKeep: 1,
          deleteBuildRecord: true,
          deleteTestResults: true,
        },
      ],
      queue: {
        name: "Default",
        pool: { name: "Default" },
      },
      buildNumberFormat: "$(date:yyyyMMdd)$(rev:.r)",
      jobAuthorizationScope: 1,
      jobTimeoutInMinutes: 60,
      jobCancelTimeoutInMinutes: 5,
      process: {
        yamlFilename: ".azuredevops/pipeline-azure.yml",
        type: 2,
      },
      repository: {
        properties: {
          safeRepository: repositoryInfo.id,
          reportBuildStatus: true,
          fetchDepth: 0,
          cleanOptions: 3,
          gitLfsSupport: false,
          skipSyncSource: false,
          checkoutNestedSubmodules: false,
        },
        id: repositoryInfo.id,
        type: "TfsGit",
        name: repositoryInfo.id,
        defaultBranch: "refs/heads/master",
        clean: true,
        checkoutSubmodules: false,
      },
      name: repositoryInfo.name,
      path: "\\",
      type: 2,
      project: {
        id: repositoryInfo.project.id,
      },
    };

    return this.axios.post<any, AxiosResponse<AzurePipelineDefinition>>(
      `https://dev.azure.com/${organization}/${repositoryInfo.project.id}/_apis/build/definitions`,
      JSON.stringify(payload),
      {
        params: {
          "api-version": "5.0",
        },
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }

  async definition({ organization, project, repository }: AzureRepositoryKey) {
    const info = await this.getByRepoName({
      organization,
      project,
      repository,
    });
    if (!info) return undefined;

    const { id, revision } = info;

    return this.axios.get<any, AxiosResponse<AzurePipelineDefinition>>(
      `https://dev.azure.com/${organization}/${project}/_apis/build/definitions/${id}`,
      {
        params: {
          "api-version": "6.0-preview.7",
          revision,
        },
      }
    );
  }
  async rename(
    renameTo: string,
    { organization, project, repository }: AzureRepositoryKey
  ) {
    const res = await this.definition({ organization, project, repository });
    if (!res) return undefined;
    const { id: definitionId } = res.data;

    return this.axios.put<any, AxiosResponse<AzurePipelineDefinition>>(
      `https://dev.azure.com/${organization}/${project}/_apis/build/definitions/${definitionId}`,
      JSON.stringify({
        ...res.data,
        name: renameTo,
      }),
      {
        params: {
          "api-version": "6.0-preview.7",
        },
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }

  async remove(
    { organization, project, repository }: AzureRepositoryKey,
    useDefaultThrow = true
  ): Promise<AxiosResponse | undefined> {
    const res = await this.definition({ organization, project, repository });
    if (!res) return undefined;

    const { id: definitionId } = res.data;

    return this.axios.delete<any, any>(
      `https://dev.azure.com/${organization}/${project}/_apis/build/definitions/${definitionId}`,
      {
        params: {
          "api-version": "6.0-preview.7",
        },
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        validateStatus: useDefaultThrow ? undefined : () => true,
      }
    );
  }

  async run(
    { organization, project, repository }: AzureRepositoryKey,
    {
      stagesToSkip,
      resources,
      templateParameters,
      variables,
    }: {
      stagesToSkip?: [];
      resources?: {
        repositories: { self: { refName: string } };
      };
      templateParameters?: Record<string, string | number | boolean>;
      variables?: Record<string, string | number | boolean>;
    }
  ) {
    const res = await this.definition({ organization, project, repository });
    if (!res) return undefined;

    const { id: definitionId } = res.data;

    return this.axios.post<any, AxiosResponse<AzurePipelineRunResult>>(
      `https://dev.azure.com/${organization}/${project}/_apis/pipelines/${definitionId}/runs?api-version=7.0`,
      JSON.stringify({
        ...{
          resources: {
            repositories: { self: { refName: "refs/heads/master" } },
          },
        },
        stagesToSkip,
        resources,
        templateParameters,
        variables,
        previewRun: "false",
      }),
      {
        params: {
          "api-version": "6.0-preview.7",
        },
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }
  async builds(
    {
      organization,
      project,
    }: Pick<AzureRepositoryKey, "organization" | "project">,
    params: BuildQueryParams
  ) {
    const { buildIds, definitions, properties, queues, tagFilters } = params;

    const commaOrUndefined = (arr: any[] | undefined) =>
      arr ? arr.join(",") : undefined;

    // GET https://dev.azure.com/{organization}/{project}/_apis/build/builds?definitions={definitions}&queues={queues}&buildNumber={buildNumber}&minTime={minTime}&maxTime={maxTime}&requestedFor={requestedFor}&reasonFilter={reasonFilter}&statusFilter={statusFilter}&resultFilter={resultFilter}&tagFilters={tagFilters}&properties={properties}&$top={$top}&continuationToken={continuationToken}&maxBuildsPerDefinition={maxBuildsPerDefinition}&deletedFilter={deletedFilter}&queryOrder={queryOrder}&branchName={branchName}&buildIds={buildIds}&repositoryId={repositoryId}&repositoryType={repositoryType}&api-version=7.1-preview.7
    const queries = {
      ...params,
      "api-version": "6.0-preview",
    };
    if (buildIds) queries.buildIds = commaOrUndefined(buildIds) as any;
    if (definitions) queries.definitions = commaOrUndefined(definitions) as any;
    if (properties) queries.properties = commaOrUndefined(properties) as any;
    if (queues) queries.queues = commaOrUndefined(queues) as any;
    if (tagFilters) queries.tagFilters = commaOrUndefined(tagFilters) as any;
    try {
      return await this.axios.get<
        any,
        AxiosResponse<AzureListResult<AzurePipelineDefinition>>
      >(`https://dev.azure.com/${organization}/${project}/_apis/build/builds`, {
        params: queries,
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.error(error);
    }
  }
  async timeline(
    {
      organization,
      project,
    }: Pick<AzureRepositoryKey, "organization" | "project">,
    buildId: number
  ) {
    try {
      return await this.axios.get<any, AxiosResponse<TimelineResult>>(
        `https://dev.azure.com/${organization}/${project}/_apis/build/builds/${buildId}/Timeline`,
        {
          params: {
            "api-version": "6.0-preview",
          },
          headers: {
            Accept: "application/json",
          },
        }
      );
    } catch (error) {
      console.error(error);
    }
  }
}
