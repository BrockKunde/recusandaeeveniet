import { LitElement, property, html, css } from 'lit-element';
import { ApolloClient, gql } from 'apollo-boost';
// import { styleMap } from 'lit-html/directives/style-map';
// https://github.com/Polymer/lit-html/issues/729
export const styleMap = style => {
  return Object.entries(style).reduce((styleString, [propName, propValue]) => {
    propName = propName.replace(/([A-Z])/g, matches => `-${matches[0].toLowerCase()}`);
    return `${styleString}${propName}:${propValue};`;
  }, '');
};

import { TextNode } from '@uprtcl/documents';
import { sharedStyles } from '@uprtcl/lenses';
import { ApolloClientModule } from '@uprtcl/graphql';
import { moduleConnect, Logger } from '@uprtcl/micro-orchestrator';
import { ContentUpdatedEvent, CONTENT_UPDATED_TAG } from '@uprtcl/evees';

import '@material/mwc-top-app-bar';

export class WikiPage extends moduleConnect(LitElement) {
  
  logger = new Logger('WIKI-PAGE');

  @property({ type: String })
  pageHash!: string;

  @property({ type: Object })
  textNode!: TextNode;

  @property({ type: String })
  color!: string;

  back() {
    this.dispatchEvent(new CustomEvent('nav-back'));
  }

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener(CONTENT_UPDATED_TAG, ((e: ContentUpdatedEvent) => {
      this.logger.info('CATCHED EVENT: content-updated ', { pageHash: this.pageHash, e });
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('page-title-changed', { detail: { pageId: e.detail.perspectiveId }}));
    }) as EventListener);
  }

  async firstUpdated() {
    const client: ApolloClient<any> = this.request(ApolloClientModule.bindings.Client);
    const result = await client.query({
      query: gql`{
        entity(id: "${this.pageHash}") {
          id

          ... on Perspective {
            head {
              id
              data {
                id
                ... on TextNode {
                  text
                  links
                }
              }
            }
          }

        }
      }`
    });

    this.textNode = result.data.entity.head.data;
  }

  render() {
    if (!this.textNode)
      return html`
        <cortex-loading-placeholder></cortex-loading-placeholder>
      `;

    return html`
      <div
        class="color-bar"
        style=${styleMap({
          backgroundColor: this.color
        })}
      ></div>

      <div class="top-row">
        <mwc-icon-button icon="arrow_back_ios" @click=${this.back}></mwc-icon-button>
      </div>

      <div class="page-content">
        <div class="text-editor">
          <cortex-entity
            .hash=${this.pageHash}
            lens-type="evee"
            .context=${{ onlyChildren: 'false', color: this.color }}
          >
          </cortex-entity>
        </div>
      </div>
    `;
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          width: 100%;
        }
        .color-bar {
          height: 1vw;
          max-height: 5px;
          width: 100%;
          margin-bottom: 1vw;
        }
        .page-content {
          margin: 0 auto;
          max-width: 900px;
        }
        .top-row {
          margin: 16px 0px 2vw 1.5vw;
        }
        .text-editor {
          padding: 0vw 0vw;
        }
      `
    ];
  }
}
