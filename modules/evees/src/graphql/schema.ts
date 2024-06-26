import gql from 'graphql-tag';
import { DocumentNode } from 'graphql';

export const eveesTypeDefs: DocumentNode = gql`
  scalar Date

  extend type Mutation {
    updatePerspectiveHead(
      perspectiveId: ID!, 
      headId: ID!): Perspective!

    createCommit(
      creatorsIds: [String], 
      dataId: ID!, 
      parentsIds: [ID!]!, 
      message: String, 
      source: String, 
      timestamp: Date!): Commit!

    createPerspective(
      creatorId: String!,
      origin: String!, 
      timestamp: Date!,
      headId: ID, 
      context: String, 
      name: String, 
      authority: String, 
      canWrite: String,
      parentId: String): Perspective!

    deletePerspective(
      perspectiveId: ID!): Perspective!

    addProposal(
      toPerspectiveId: ID!, 
      fromPerspectiveId: ID!, 
      updateRequests: [HeadUpdateInput!]): UpdateProposal!

    authorizeProposal(
      proposalId: ID!, 
      perspectiveId: ID!, 
      authorize: Boolean!): UpdateProposal!

    executeProposal(
      proposalId: ID!, 
      perspectiveId: ID!): UpdateProposal!
  }

  type Context {
    id: String!
    perspectives: [Perspective!] @discover
  }

  type HeadUpdate {
    fromPerspective: Perspective! @discover
    oldHead: Commit! @discover
    toPerspective: Perspective! @discover
    newHead: Commit! @discover
  }

  # Exact match to UpdateRequest typescript type
  input HeadUpdateInput {
    fromPerspectiveId: String
    oldHeadId: String
    perspectiveId: String
    newHeadId: String
  }

  type UpdateProposal {
    id: ID!
    
    creatorId: String
    toPerspective: Perspective! @discover
    fromPerspective: Perspective! @discover
    updates: [HeadUpdate!]
    authorized: Boolean,
    canAuthorize: Boolean,
    executed: Boolean
  }

  type Commit implements Entity {
    id: ID!

    parentCommits: [Commit!]! @discover
    timestamp: Date!
    message: String
    data: Entity @discover
    creatorsIds: [ID!]!

    _context: EntityContext!
  }

  type Perspective implements Entity {
    id: ID!

    head: Commit @discover
    name: String
    context: Context
    payload: Payload
    proposals: [UpdateProposal!]

    _context: EntityContext!
  }

  type Payload {
    origin: String
    creatorId: String
    timestamp: Date
  }
`;
