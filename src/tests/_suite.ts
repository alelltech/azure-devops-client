import * as assert from "assert";

import {
  azureAxiosInstance,
  AzurePipelineService,
  AzureRepoService,
  AzureOrganizationService,
  AzureVariableGroupService,
  AzureEntitlementsService,
  AzureServiceConnectionService,
} from "../";

describe("Azure DevOps Axios Services", () => {
  const organization = "alelltech";
  const project = "labs";
  const repository = "azdo-tasks-tests";
  const renameTo = `DELETE-ME-${repository}`;

  const repoKey = {
    organization,
    project,
    repository,
  };

  const azurePAT =
    process.env.API_TOKEN || process.env.AZURE_DEVOPS_TOKEN || "";

  const axiosHandler = azureAxiosInstance(azurePAT);
  describe("Azure DevOps Repository Services", () => {
    const service = new AzureRepoService(axiosHandler);

    it("Service instance check", async () => {
      assert(service);
    });

    it("exists", async () => {
      const result = await service.info({ organization, project, repository });

      assert(result.status != 500);
    });

    // it('rename', async () => {
    //   const res = await service.rename(renameTo, repoKey);
    //   assert(res.status != 500);
    //   assert(res.data.name === renameTo);

    //   await service.rename(repository, {
    //     organization,
    //     project,
    //     repository: renameTo,
    //   });
    // });

    it("item", async () => {
      const res = await service.item("/readme.md", "main", repoKey);
      assert(res.status != 500);
      assert(res.data.commitId);
    });

    // it('push', async () => {
    //   const {
    //     data: { content: catalogInfoContent, commitId },
    //   } = await service.item('/catalog-info.yaml', 'master', repoKey);

    //   const pushResult = await service.push(
    //     {
    //       commits: [
    //         {
    //           comment: 'Repository push test',
    //           changes: [
    //             {
    //               changeType: 2,
    //               item: {
    //                 path: '/catalog-info.yaml',
    //               },
    //               newContent: {
    //                 content: `# Repository push Test ${new Date().getTime()}\n${catalogInfoContent}`,
    //                 contentType: 0,
    //               },
    //             },
    //           ],
    //         },
    //       ],
    //       refUpdates: [
    //         {
    //           name: 'refs/heads/master',
    //           oldObjectId: commitId,
    //         },
    //       ],
    //     },
    //     repoKey,
    //   );

    //   assert(pushResult.status != 500);
    //   assert(pushResult.data.id);
    // });

    it("list", async () => {
      const result = await service.list({ organization, project });

      assert(result.status != 500);
    });

    // it('remove', async () => {
    //   const result = await service.remove({
    //     organization,
    //     project,
    //     repository: 'RECREATED-1657911959804-remove-test-06',
    //   });

    //   assert(result?.status != 500);
    // });

    // it('clean RECREATED-*', async () => {
    //   const org = {organization: 'alelltech', project: 'labs'}
    //   const allrepo = await service.list(org)
    //   const filtered = allrepo.data.filter(r => r.name.toLocaleLowerCase().startsWith('recreated-'))
    //   for (const { name: repo_name } of filtered) {

    //     const result = await service.remove({
    //       ...org,
    //       repository: repo_name,
    //     });
    //     assert(result?.status != 500);
    //   }
    // });
  }).timeout(30000);

  describe("Azure DevOps Organization Services", () => {
    const service = new AzureOrganizationService(axiosHandler, organization);

    it("Service instance check", async () => {
      assert(service);
    });

    it("exists", async () => {
      const result = await service.list();
      assert(result[0].id);
    });
  }).timeout(30000);

  describe("Azure DevOps Pipeline Services", () => {
    const repoService = new AzureRepoService(axiosHandler);
    const service = new AzurePipelineService(axiosHandler, repoService);

    it("Service instance check", async () => {
      assert(service);
    });

    it("exists", async () => {
      const result = await service.list({ organization, project });
      assert(result.data?.value?.[0].id);
    }).timeout(60000);

    it("getByRepoName", async () => {
      const result = await service.getByRepoName({
        organization,
        project,
        repository,
      });
      assert(result?.id);
    }).timeout(60000);
    it("definition", async () => {
      const info = await service.definition({
        organization,
        project,
        repository,
      });
      assert(info);
      assert(info?.data?.name);
    }).timeout(30000);

    it("builds", async () => {
      const info = await service.builds(
        {
          organization,
          project,
        },
        { buildIds: [315751] }
      );
      assert(info);
      assert(info?.data?.value?.[0]?._links);
    }).timeout(30000);

    it("timeline", async () => {
      const info = await service.timeline(
        {
          organization,
          project,
        },
        315751
      );
      assert(info);
      assert(info?.data?.records?.[3]?.log);
    }).timeout(30000);
  });

  describe("Azure DevOps Library Group Services", () => {
    const service = new AzureVariableGroupService(axiosHandler);

    it("Service instance check", async () => {
      assert(service);
    });

    it("list", async () => {
      const result = await service.list({ organization, project });
      assert(result.data);
    });
    it("getByRepoName", async () => {
      const result = await service.getByRepoName({
        organization,
        project,
        repository,
      });
      assert(result.id);
      assert(result.name === repository);
    });

    it("distributedTask", async () => {
      const distributedTask = await service.distributedTask({
        organization,
        project,
        repository,
      });
      assert(distributedTask);
      assert(distributedTask?.data?.name === repository);
    });

    // it("rename", async () => {
    //   const res = await service.rename(renameTo, {
    //     organization,
    //     project,
    //     repository,
    //   });
    //   assert(res);

    //   assert(res?.status !== 500);
    //   assert(res?.data.name === repository);

    //   await service.rename(repository, {
    //     organization,
    //     project,
    //     repository: renameTo,
    //   });
    // });

    // it("remove", async () => {
    //   const result = await service.remove({
    //     organization,
    //     project,
    //     repository: "RECREATED-1658325737455-remove-test-06",
    //   });

    //   assert(result?.status);
    //   assert(result?.status !== 500);
    // });
  });
  describe("Azure DevOps Entitlements Services", () => {
    const organization = "alelltech";
    const userName = "alan.ferreira.ext";
    const userEmail = `${userName}@telefonicati.onmicrosoft.com`;
    const axiosHandler = azureAxiosInstance(azurePAT);

    const service = new AzureEntitlementsService(axiosHandler);

    it("Service instance check", async () => {
      assert(service);
    });

    // it('raw mode', async () => {
    //   var axios = require("axios").default;

    //   var options = {
    //     method: 'GET',
    //     url: 'https://vsaex.dev.azure.com/alelltech/_apis/userentitlements',
    //     params: {
    //       select: 'Projects',
    //       $filter: 'name eq \'alan.ferreira.ext@telefonicati.onmicrosoft.com\'',
    //       'api-version': '6.0-preview.3'
    //     },
    //     headers: {
    //       // cookie: 'VstsSession=%257B%2522PersistentSessionId%2522%253A%2522f666c59c-47b8-4980-bd45-98a3e27b9596%2522%252C%2522PendingAuthenticationSessionId%2522%253A%252200000000-0000-0000-0000-000000000000%2522%252C%2522CurrentAuthenticationSessionId%2522%253A%252200000000-0000-0000-0000-000000000000%2522%252C%2522SignInState%2522%253A%257B%257D%257D',
    //       Authorization: 'Basic Om0yejRpMms2eHhnbGpuZWxzcHNwaTVhc3M3endieTJxeW1ubmRiY2t6NGJqbWtjZXpscGE='
    //     }
    //   };

    //   const res = await axios.request(options);
    //   expect(res.status).toEqual(200)

    // })

    it("user projects", async () => {
      const result = await service.userEntitlements({
        organization,
        select: "Projects",
        $filter: `name eq '${userEmail}'`,
      });

      assert(result.status === 200);
    }).timeout(60000);
  });
  describe("Azure DevOps Service Connection Services", () => {
    const service = new AzureServiceConnectionService(axiosHandler);
    const organization = "alelltech";
    const project = "labs";

    it("Service instance check", async () => {
      assert(service);
    });

    it("list", async () => {
      const result = await service.list(
        { organization, project },
        { type: "kubernetes" }
      );
      assert(result.data);
    });
  });
});
