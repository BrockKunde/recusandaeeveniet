import { ApolloClient, gql } from 'apollo-boost';

import { DiscoveryService, DiscoveryModule, Store, StoresModule } from '@uprtcl/multiplatform';
import { IsSecure } from '@uprtcl/cortex';
import { ApolloClientModule } from '@uprtcl/graphql';

import { Secured } from '../patterns/default-secured.pattern';
import { Commit, Perspective } from '../types';
import { EveesBindings } from '../bindings';
import { Evees } from '../services/evees';
import { ProposalsProvider } from '../services/proposals.provider';
import { EveesRemote } from '../services/evees.remote';
import { NewPerspectiveData } from '../services/evees.provider';

export const eveesResolvers = {
  Commit: {
    message(parent) {
      return parent.payload.message;
    },
    timestamp(parent) {
      return parent.payload.timestamp;
    },
    parentCommits(parent) {
      return parent.payload.parentsIds;
    },
    data(parent) {
      return parent.payload.dataId;
    },
    creatorsIds(parent) {
      return parent.payload.creatorsIds;
    }
  },
  Context: {
    id(parent) {
      return typeof parent === 'string' ? parent : parent.context;
    },
    async perspectives(parent, _, { container }) {
      const context = typeof parent === 'string' ? parent : parent.context;

      const evees: Evees = container.get(EveesBindings.Evees);

      return evees.getContextPerspectives(context);
    }
  },
  UpdateProposal: {
    toPerspective(parent) {
      return parent.toPerspectiveId;
    },
    fromPerspective(parent) {
      return parent.fromPerspectiveId;
    }
  },
  Perspective: {
    async head(parent, _, { container }) {
      const evees: Evees = container.get(EveesBindings.Evees);

      const remote = evees.getPerspectiveProvider(parent);
      const details = await remote.getPerspectiveDetails(parent.id);

      return details && details.headId;
    },
    async name(parent, _, { container }) {
      const evees: Evees = container.get(EveesBindings.Evees);

      const remote = evees.getPerspectiveProvider(parent);
      const details = await remote.getPerspectiveDetails(parent.id);

      return details && details.name;
    },
    async context(parent, _, { container }) {
      const evees: Evees = container.get(EveesBindings.Evees);

      const remote = evees.getPerspectiveProvider(parent);
      const details = await remote.getPerspectiveDetails(parent.id);

      return details && details.context;
    },
    async proposals(parent, _, { container }) {
      const evees: Evees = container.get(EveesBindings.Evees);

      const remote = evees.getPerspectiveProvider(parent);

      if (!remote.proposals) return [];

      const proposalsIds = await remote.proposals.getProposalsToPerspective(parent.id);
      const proposalsPromises = proposalsIds.map(proposalId => {
        return (remote.proposals as ProposalsProvider).getProposal(proposalId);
      });

      const proposals = await Promise.all(proposalsPromises);

      return proposals;
    }
  },
  Mutation: {
    async createCommit(
      _,
      { creatorsIds, dataId, parentsIds, message, source, timestamp },
      { container }
    ) {
      const remotes = container.getAll(EveesBindings.EveesRemote);
      const discovery: DiscoveryService = container.get(DiscoveryModule.bindings.DiscoveryService);
      const secured: IsSecure<any> = container.get(EveesBindings.Secured);

      const commitData: Commit = {
        creatorsIds: creatorsIds,
        dataId: dataId,
        message: message,
        timestamp: timestamp,
        parentsIds: parentsIds
      };

      const remote: EveesRemote = remotes.find(r => r.source === source);
      const commit: Secured<Commit> = await secured.derive()(commitData, remote.hashRecipe);

      await remote.cloneCommit(commit);
      await discovery.postEntityCreate(remote, commit);

      return {
        id: commit.id,
        ...commit.object
      };
    },

    async updatePerspectiveHead(parent, { perspectiveId, headId }, { container }) {
      const evees: Evees = container.get(EveesBindings.Evees);
      const discovery: DiscoveryService = container.get(DiscoveryModule.bindings.DiscoveryService);
      const client: ApolloClient<any> = container.get(ApolloClientModule.bindings.Client);

      const provider = await evees.getPerspectiveProviderById(perspectiveId);

      await provider.updatePerspectiveDetails(perspectiveId, { headId });

      await discovery.postEntityUpdate(provider, [headId]);

      const result = await client.query({
        query: gql`{
        entity(id: "${perspectiveId}") {
          id
          _context {
            raw
          }
        }
      }`
      });

      const perspective = JSON.parse(result.data.entity._context.raw);

      if (!perspective) throw new Error(`Perspective with id ${perspectiveId} not found`);

      return { id: perspectiveId, ...perspective, head: { id: headId } };
    },
    
    async deletePerspective(parent, { perspectiveId }, { container }) {
      const evees: Evees = container.get(EveesBindings.Evees);
      const remote = await evees.getPerspectiveProviderById(perspectiveId);
      await remote.deletePerspective(perspectiveId);
      return { id: perspectiveId };
    },

    async createPerspective(
      _,
      { creatorId, origin, timestamp, headId, context, name, authority, canWrite, parentId },
      { container }
    ) {
      const remotes = container.getAll(EveesBindings.EveesRemote);
      const secured: IsSecure<any> = container.get(EveesBindings.Secured);

      const remote: EveesRemote = remotes.find(remote => remote.authority === authority);

      const perspectiveData: Perspective = {
        creatorId,
        origin,
        timestamp
      };
      const perspective: Secured<Perspective> = await secured.derive()(
        perspectiveData,
        remote.hashRecipe
      );

      const newPerspectiveData: NewPerspectiveData = {
        perspective,
        details: { headId, name, context },
        canWrite,
        parentId
      }
      await remote.cloneAndInitPerspective(newPerspectiveData);

      return {
        id: perspective.id,
        name: name,
        head: headId,
        context: context,
        payload: {
          creatorId,
          origin,
          timestamp
        }
      };
    },

    async addProposal(
      _,
      { toPerspectiveId, fromPerspectiveId, updateRequests },
      { container }
    ) {
      const evees: Evees = container.get(EveesBindings.Evees);

      const remote = await evees.getPerspectiveProviderById(toPerspectiveId);
      if (!remote.proposals) throw new Error('remote cant handle proposals');

      const proposalId = await remote.proposals.createProposal(
        fromPerspectiveId,
        toPerspectiveId,
        updateRequests
      );

      return {
        id: proposalId,
        toPerspectiveId: toPerspectiveId,
        fromPerspectiveId: fromPerspectiveId,
        updates: updateRequests,
        authorized: false,
        canAuthorize: false,
        executed: false
      }
    },

    async authorizeProposal(
      _,
      { proposalId, perspectiveId, authorize },
      { container }
    ) {

      const client: ApolloClient<any> = container.get(ApolloClientModule.bindings.Client);
      const evees: Evees = container.get(EveesBindings.Evees);

      const perspectiveResult = await client.query({
        query: gql`{
        entity(id: "${perspectiveId}") {
          id
          _context {
            raw
          }
        }
      }`
      });

      const perspective = JSON.parse(perspectiveResult.data.entity._context.raw);

      const remote = evees.getAuthority(perspective.payload.origin);
      if (!remote.proposals) throw new Error('remote cant handle proposals');

      if (authorize) {
        await remote.proposals.acceptProposal(proposalId);
      } else {
        await remote.proposals.declineProposal(proposalId);
      }

      return {
        id: proposalId,
        authorized: authorize,
      }

    },
    async executeProposal(
      _,
      { proposalId, perspectiveId },
      { container }
    ) {

      const client: ApolloClient<any> = container.get(ApolloClientModule.bindings.Client);
      const evees: Evees = container.get(EveesBindings.Evees);

      const perspectiveResult = await client.query({
        query: gql`{
        entity(id: "${perspectiveId}") {
          id
          _context {
            raw
          }
        }
      }`
      });

      const perspective = JSON.parse(perspectiveResult.data.entity._context.raw);

      const remote = evees.getAuthority(perspective.payload.origin);
      if (!remote.proposals) throw new Error('remote cant handle proposals');

      await remote.proposals.executeProposal(proposalId);
      
      return {
        id: proposalId,
        toPerspectiveId: perspectiveId,
        executed: true,
      }

    }
  }
};

export const contentCreateResolver = async (content, source, container) => {
  const stores: Store[] = container.getAll(StoresModule.bindings.Store);

  const store = stores.find(d => d.source === source);

  if (!store) throw new Error(`No store registered for source ${source}`);

  const id = await store.put(content);

  return { id, ...content };
}
