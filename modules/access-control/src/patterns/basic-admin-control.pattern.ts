import { html } from 'lit-element';
import { injectable } from 'inversify';

import { Pattern } from '@uprtcl/cortex';
import { HasLenses } from '@uprtcl/lenses';

import { Permissions } from '../properties/permissions';
import { BasicAdminPermissions } from '../services/basic-admin-control.service';

@injectable()
export class BasicAdminPattern implements Pattern, HasLenses, Permissions<BasicAdminPermissions> {
  recognize = (entity: any) => {
    return (
      (entity as BasicAdminPermissions).publicWrite !== undefined &&
      (entity as BasicAdminPermissions).publicRead !== undefined &&
      (entity as BasicAdminPermissions).canAdmin !== undefined &&
      (entity as BasicAdminPermissions).canRead !== undefined &&
      (entity as BasicAdminPermissions).canWrite !== undefined
    );
  };

  canWrite = (entity: BasicAdminPermissions) => (userId: string | undefined): boolean => {
    if (entity.publicWrite) return true;
    if (!userId) return false;
    if (entity.canWrite.includes(userId)) return true;
    if (entity.canAdmin.includes(userId)) return true;
    return false;
  };

  lenses = (entity: BasicAdminPermissions) => [
    {
      name: 'basic-admin-access-control',
      type: 'permissions',
      render: (_, context: any) =>
        html`
          <!-- <h1>?</h1> -->
          <permissions-admin
            .permissions=${entity}
            .canWrite=${context.canWrite}
            .entityId=${context.entityId}
          ></permissions-admin>
        `
    }
  ];
}
