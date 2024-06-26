import { property, html, css } from 'lit-element';
import { ApolloClient, gql } from 'apollo-boost';
// import { styleMap } from 'lit-html/directives/style-map';
// https://github.com/Polymer/lit-html/issues/729

export const styleMap = style => {
  return Object.entries(style).reduce((styleString, [propName, propValue]) => {
    propName = propName.replace(/([A-Z])/g, matches => `-${matches[0].toLowerCase()}`);
    return `${styleString}${propName}:${propValue};`;
  }, '');
};

import '@material/mwc-drawer';

import {
  EveesContent
} from '@uprtcl/evees';
import { htmlToText, TextType, DocumentsModule } from '@uprtcl/documents';
import { Logger } from '@uprtcl/micro-orchestrator';
import { sharedStyles } from '@uprtcl/lenses';
import { Hashed } from '@uprtcl/cortex';
import { MenuConfig } from '@uprtcl/evees';

import { Wiki } from '../types';
import { WikiBindings } from 'src/bindings';

export class WikiDrawer extends EveesContent<Wiki>{
  
  logger = new Logger('WIKI-DRAWER');

  @property({ type: String })
  selectedPageHash: string | undefined = undefined;

  @property({ type: Object, attribute: false })
  pagesList: Array<{ title: string; id: string }> | undefined = undefined;

  symbol: symbol | undefined = WikiBindings.WikiEntity;
  
  getEmptyEntity(): Wiki {
    throw new Error("Method not implemented.");
  }

  async firstUpdated() {
    super.firstUpdated();

    this.logger.log('firstUpdated()', { data: this.data, dataInit: this.dataInit });

    this.updateRefData();
    this.loadPagesData();
  }

  updated(changedProperties: any) {
    this.logger.log('updated()', { changedProperties, data: this.data, dataInit: this.dataInit });
    if (changedProperties.get('data') !== undefined) {
      this.loadPagesData();
    }
  }

  async loadPagesData() {
    this.logger.log('loadPagesData()');
    if (!this.data) return;

    const wiki = this.data as Hashed<Wiki>;

    const pagesListPromises = wiki.object.pages.map(async pageId => {
      if (!this.client) throw new Error('client is undefined');
      const result = await this.client.query({
        query: gql`
        {
          entity(id: "${pageId}") {
            id
            _context {
              patterns {
                content {
                  id
                  _context {
                    patterns {
                      title
                    }
                  }
                }
              }
            }
          }
        }`
      });

      return {
        id: pageId,
        title: result.data.entity._context.patterns.content._context.patterns.title
      };
    });

    this.pagesList = await Promise.all(pagesListPromises);
    this.logger.log('loadPagesData()', { pagesList: this.pagesList });    
  }

  selectPage(pageHash: string | undefined) {
    this.dispatchEvent(
      new CustomEvent('page-selected', {
        detail: {
          pageId: pageHash
        }
      })
    );

    this.selectedPageHash = pageHash;
  }

  newPage() {
    const pageContent = {
      text: '<h1><br></h1>',
      type: TextType.Title,
      links: []
    };

    this.createChild(pageContent, DocumentsModule.bindings.TextNodeEntity);
  }

  optionOnPage(pageIndex: number, option: string) {
    switch (option) {
      case 'move-up': 
        this.moveChildElement(pageIndex, pageIndex - 1);
        break;
      
      case 'move-down': 
        this.moveChildElement(pageIndex, pageIndex + 1);
        break;

      case 'remove': 
        this.removeChildElement(pageIndex);
        break;
    }
  }

  renderPageList() {
    if (!this.pagesList)
      return html`
        <cortex-loading-placeholder></cortex-loading-placeholder>
      `;

    if (this.pagesList.length === 0)
      return html`
        <div class="empty">
          <span><i>${this.t('wikis:no-pages-yet')}</i></span>
        </div>
      `;

    return html`
      <mwc-list>
        ${this.pagesList.map((page, ix) => {
          const menuConfig: MenuConfig = {
            'move-up': {
              disabled: ix === 0,
              text: 'move up',
              graphic: 'arrow_upward'
            },
            'move-down': {
              disabled: ix === ((this.pagesList as any[]).length - 1),
              text: 'move down',
              graphic: 'arrow_downward'
            },
            'remove': {
              disabled: false,
              text: 'remove',
              graphic: 'clear'
            },
          }
          this.logger.log(`rendering page title ${page.id}`, menuConfig);
          const text = htmlToText(page.title);
          const empty = text === '';
          return html`
            <evees-list-item 
              class=${empty ? 'title-empty' : '' }
              text=${empty ? 'untitled' : text} 
              @item-click=${() => this.selectPage(page.id)}
              @option-click=${(e) => this.optionOnPage(ix, e.detail.option)}
              .config=${menuConfig}>
            </evees-list-item>
          `;
        })}
      </mwc-list>
    `;
  }

  render() {
    this.logger.log('render()', { data: this.data, ref: this.ref, editable: this.editable, level: this.level });
    if (!this.data || !this.ref)
      return html`
        <cortex-loading-placeholder></cortex-loading-placeholder>
      `;

    return html`
      <mwc-drawer>
        <div class="column">
          <div
            class="color-bar"
            style=${styleMap({
              backgroundColor: this.color
            })}
          ></div>

          ${this.editable
            ? html`
                <div class="button-row">
                  <mwc-button outlined icon="note_add" @click=${this.newPage}>
                    ${this.t('wikis:new-page')}
                  </mwc-button>
                </div>
              `
            : html``}
          <div>
            ${this.renderPageList()}
          </div>
        </div>

        <div slot="appContent" class="fill-content">
          ${this.selectedPageHash
            ? html`
                <wiki-page
                  @nav-back=${() => this.selectPage(undefined)}
                  @page-title-changed=${() => this.loadPagesData()}
                  pageHash=${this.selectedPageHash}
                  color=${this.color ? this.color : ''}
                >
                </wiki-page>
              `
            : html`
                <wiki-home
                  wikiHash=${this.ref}
                  title=${this.data.object.title}
                  color=${this.color ? this.color : ''}
                >
                  <slot slot="evee-page" name="evee-page"></slot>
                </wiki-home>
              `}
        </div>
      </mwc-drawer>
    `;
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, 'Apple Color Emoji',
            Arial, sans-serif, 'Segoe UI Emoji', 'Segoe UI Symbol';
          color: #37352f;
        }
        .evee-info {
          height: 40px;
        }
        .column {
          height: 100%;
          background-color: #f7f6f3;
        }
        .color-bar {
          height: 1vw;
          max-height: 5px;
          width: 100%;
        }
        .title-empty {
          color: #a2a8aa;
          font-style: italic;
        }
        .empty {
          width: 100%;
          text-align: center;
          padding-top: 24px;
          color: #a2a8aa;
        }
        .button-row {
          margin: 16px 0px 8px 0px;
          text-align: center;
          width: 100%;
        }
      `
    ];
  }
}
