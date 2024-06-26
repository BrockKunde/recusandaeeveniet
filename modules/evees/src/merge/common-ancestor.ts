import { Secured } from '../patterns/default-secured.pattern';
import { Source } from '@uprtcl/multiplatform';

import { Commit } from '../types';
import { ApolloClient, gql } from 'apollo-boost';

interface Path {
  visited: { [commitId: string]: boolean };
  heads: string[];
}

export class FindMostRecentCommonAncestor {
  allCommits: { [key: string]: Secured<Commit> } = {};
  paths: Path[];

  constructor(protected client: ApolloClient<any>, commitsIds: string[]) {
    this.paths = commitsIds.map(commitId => ({
      visited: {},
      heads: [commitId]
    }));
  }

  private getMostRecentCommonAncestor(pathToExplore: Path): string | undefined {
    // Do we have a commit that has already been visited by all other paths?
    const otherPaths = this.paths.filter(p => p !== pathToExplore);
    return pathToExplore.heads.find(commitId => otherPaths.every(path => path.visited[commitId]));
  }

  /**
   * Explore the given path: get the parents of its heads and prepare the path for the next iteration
   */
  private async explorePath(pathToExplore: Path): Promise<Path> {
    const promises = pathToExplore.heads.map(async commitId => {
      let commit: Secured<Commit> | undefined = this.allCommits[commitId];
      if (!commit) {
        commit = await this.getCommit(commitId);

        if (!commit) throw new Error('Could not get ancestor commit');

        this.allCommits[commitId] = commit;
      }

      pathToExplore.visited[commitId] = true;
      return commit;
    });

    const commits = await Promise.all(promises);
    const nextCommits = commits.map(commit => commit.object.payload.parentsIds);

    pathToExplore.heads = Array.prototype.concat.apply([], nextCommits);
    return pathToExplore;
  }

  public async getCommit(commitId: string): Promise<Secured<Commit>> {

    const result = await this.client.query({
      query: gql`{
        entity(id: "${commitId}") {
          id
          _context {
            raw
          }
        }
      }`
    });

    return { id: commitId, object: JSON.parse(result.data.entity._context.raw) };
  }

  public async compute(): Promise<string> {
    // Iterate until there is no more parent commits to explore
    while (this.paths.find(path => path.heads.length > 0)) {
      for (let i = 0; i < this.paths.length; i++) {
        const commonAncestor = this.getMostRecentCommonAncestor(this.paths[i]);

        // If so, we have the most recent common ancestor, return it
        if (commonAncestor) {
          return commonAncestor;
        }

        // Else, explore parents and prepare for next iteration
        this.paths[i] = await this.explorePath(this.paths[i]);
      }
    }

    throw new Error('Commits do not have a common ancestor');
  }
}

export default function findMostRecentCommonAncestor(
  client: ApolloClient<any>
): (commitsIds: string[]) => Promise<string> {
  return (commitsIds: string[]) => new FindMostRecentCommonAncestor(client, commitsIds).compute();
}
