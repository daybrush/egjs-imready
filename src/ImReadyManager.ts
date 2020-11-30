/*
egjs-imready
Copyright (c) 2020-present NAVER Corp.
MIT license
*/
import Component from "@egjs/component";
import { ElementLoader } from "./loaders/ElementLoader";
import { ArrayFormat, ElementInfo, ImReadyEvents, ImReadyLoaderOptions, ImReadyOptions } from "./types";
import { toArray, getContentElements, hasLoadingAttribute } from "./utils";
/**
 * @alias eg.ImReady
 * @extends eg.Component
 */
class ImReadyManager extends Component<ImReadyEvents> {
  public options!: ImReadyOptions;
  private readyCount = 0;
  private preReadyCount = 0;
  private totalCount = 0;
  private totalErrorCount = 0;
  private isPreReadyOver = true;
  private elementInfos: ElementInfo[] = [];
  /**
   * @param - ImReady's options
   */
  constructor(options: Partial<ImReadyOptions> = {}) {
    super();
    this.options = {
      loaders: {},
      prefix: "data-",
      ...options,
    };
  }
  /**
   * Checks whether elements are in the ready state.
   * @ko 엘리먼트가 준비 상태인지 체크한다.
   * @elements - Elements to check ready status. <ko> 준비 상태를 체크할 엘리먼트들.</ko>
   * @example
     * ```html
     * <div>
     *    <img src="./1.jpg" data-width="1280" data-height="853" style="width:100%"/>
     *    <img src="./2.jpg" data-width="1280" data-height="853"/>
     *    <img src="ERR" data-width="1280" data-height="853"/>
     * </div>
     * ```
     * ## Javascript
     * ```js
     * import ImReady from "@egjs/imready";
     *
     * const im = new ImReady(); // umd: eg.ImReady
     * im.check(document.querySelectorAll("img")).on({
     *   preReadyElement: e => {
     *     // 1, 3
     *     // 2, 3
     *     // 3, 3
     *     console.log(e.preReadyCount, e.totalCount),
     *   },
     * });
     * ```
   */
  public check(elements: ArrayFormat<HTMLElement>): this {
    const { prefix } = this.options;

    this.clear();
    this.elementInfos = toArray(elements).map((element, index) => {
      const loader = this.getLoader(element, { prefix });

      loader.check();
      loader.on("error", e => {
        this.onError(index, e.target);
      }).on("preReady", e => {
        this.elementInfos[index].hasLoading = e.hasLoading;
        const isPreReady = this.checkPreReady(index);

        this.onPreReadyElement(index);

        isPreReady && this.onPreReady();
      }).on("ready", ({ withPreReady, hasLoading }) => {
        // Pre-ready and ready occur simultaneously
        this.elementInfos[index].hasLoading = hasLoading;
        const isPreReady = withPreReady && this.checkPreReady(index);
        const isReady = this.checkReady(index);

        withPreReady && this.onPreReadyElement(index);
        this.onReadyElement(index);

        isPreReady && this.onPreReady();
        isReady && this.onReady();
      });

      return {
        loader,
        element,
        hasLoading: false,
        hasError: false,
        isPreReady: false,
        isReady: false,
      };
    });

    const length = this.elementInfos.length;

    this.totalCount = length;
    if (!length) {
      setTimeout(() => {
        this.onPreReady();
        this.onReady();
      });
    }
    return this;
  }
  /**
   * Gets the total count of elements to be checked.
   * @ko 체크하는 element의 총 개수를 가져온다.
   */
  public getTotalCount() {
    return this.totalCount;
  }
  /**
   * Whether the elements are all pre-ready (all sizes are known)
   * @ko 엘리먼트들이 모두 사전 준비가 됐는지 (사이즈를 전부 알 수 있는지) 여부
   */
  public isPreReady() {
    return this.elementInfos.every(info => info.isPreReady);
  }
  /**
   * Whether the elements are all ready
   * @ko 엘리먼트들이 모두 준비가 됐는지 여부
   */
  public isReady() {
    return this.elementInfos.every(info => info.isReady);
  }
  /**
   * Clears events of elements being checked.
   * @ko 체크 중인 엘리먼트들의 이벤트를 해제 한다.
   */
  public clear() {
    this.isPreReadyOver = false;
    this.totalCount = 0;
    this.preReadyCount = 0;
    this.readyCount = 0;
    this.totalErrorCount = 0;
    this.elementInfos.forEach(info => {
      if (!info.isReady && info.loader) {
        info.loader.destroy();
      }
    });
    this.elementInfos = [];
  }
  /**
   * Destory all events .
   * @ko 모든 이벤트를 해제 한다.
   */
  public destroy() {
    this.clear();
    this.off();
  }
  private getLoader(element: HTMLElement, options: ImReadyLoaderOptions) {
    const tagName = element.tagName.toLowerCase();
    const loaders = this.options.loaders;
    const tags = Object.keys(loaders);

    if (loaders[tagName]) {
      return new loaders[tagName](element, options);
    }
    const loader = new ElementLoader(element, options);
    const children = toArray(element.querySelectorAll<HTMLElement>(tags.join(", ")));

    loader.setHasLoading(children.some(el => hasLoadingAttribute(el)));
    let withPreReady = false;

    const childrenImReady = this.clone().on("error", e => {
      loader.onError(e.target);
    }).on("ready", () => {
      loader.onReady(withPreReady);
    });

    loader.on("requestChildren", () => {
      // has not data size
      const contentElements = getContentElements(element, tags, this.options.prefix);

      childrenImReady.check(contentElements).on("preReady", e => {
        withPreReady = e.isReady;
        if (!withPreReady) {
          loader.onPreReady();
        }
      });
    }).on("reqeustReadyChildren", () => {
      // has data size
      // loader call preReady
      // check only video, image elements
      childrenImReady.check(children);
    }).on("requestDestroy", () => {
      childrenImReady.destroy();
    });

    return loader;
  }
  private clone() {
    return new ImReadyManager({ ...this.options });
  }
  private checkPreReady(index: number) {
    this.elementInfos[index].isPreReady = true;
    ++this.preReadyCount;


    if (this.preReadyCount < this.totalCount) {
      return false;
    }
    return true;
  }
  private checkReady(index: number) {
    this.elementInfos[index].isReady = true;
    ++this.readyCount;

    if (this.readyCount < this.totalCount) {
      return false;
    }
    return true;
  }


  private onError(index: number, target: HTMLElement) {
    const info = this.elementInfos[index];

    info.hasError = true;
    /**
     * An event occurs if the image, video fails to load.
     * @ko 이미지, 비디오가 로딩에 실패하면 이벤트가 발생한다.
     * @event eg.ImReady#error
     * @param {eg.ImReady.OnError} e - The object of data to be sent to an event <ko>이벤트에 전달되는 데이터 객체</ko>
     * @param {HTMLElement} [e.element] - The element with error images.<ko>오류난 이미지가 있는 엘리먼트</ko>
     * @param {number} [e.index] - The item's index with error images. <ko>오류난 이미지가 있는 엘리먼트의 인덱스</ko>
     * @param {HTMLElement} [e.target] - Error image target in element <ko>엘리먼트의 오류난 이미지 타겟</ko>
     * @param {number} [e.errorCount] - The number of elements with errors <ko>에러가 있는 엘리먼트들의 개수</ko>
     * @param {number} [e.totalErrorCount] - The total number of targets with errors <ko>에러가 있는 타겟들의 총 개수</ko>
     * @example
     * ```html
     * <div>
     *    <img src="./1.jpg" data-width="1280" data-height="853" style="width:100%"/>
     *    <img src="./2.jpg"/>
     *    <img src="ERR"/>
     * </div>
     * ```
     * ## Javascript
     * ```js
     * import ImReady from "@egjs/imready";
     *
     * const im = new ImReady(); // umd: eg.ImReady
     * im.check([document.querySelector("div")]).on({
     *   error: e => {
     *     // <div>...</div>, 0, <img src="ERR"/>
     *     console.log(e.element, e.index, e.target),
     *   },
     * });
     * ```
     */
    this.trigger("error", {
      element: info.element,
      index,
      target,
      errorCount: this.getErrorCount(),
      totalErrorCount: ++this.totalErrorCount,
    });
  }
  private onPreReadyElement(index: number) {
    const info = this.elementInfos[index];
    /**
     * An event occurs when the element is pre-ready (when the loading attribute is applied or the size is known)
     * @ko 해당 엘리먼트가 사전 준비되었을 때(loading 속성이 적용되었거나 사이즈를 알 수 있을 때) 이벤트가 발생한다.
     * @event eg.ImReady#preReadyElement
     * @param {eg.ImReady.OnPreReadyElement} e - The object of data to be sent to an event <ko>이벤트에 전달되는 데이터 객체</ko>
     * @param {HTMLElement} [e.element] - The pre-ready element.<ko>사전 준비된 엘리먼트</ko>
     * @param {number} [e.index] - The index of the pre-ready element. <ko>사전 준비된 엘리먼트의 인덱스</ko>
     * @param {number} [e.preReadyCount] - Number of elements pre-ready <ko>사전 준비된 엘리먼트들의 개수</ko>
     * @param {number} [e.readyCount] - Number of elements ready <ko>준비된 엘리먼트들의 개수</ko>
     * @param {number} [e.totalCount] - Total number of elements <ko>엘리먼트들의 총 개수</ko>
     * @param {boolean} [e.isPreReady] - Whether all elements are pre-ready <ko>모든 엘리먼트가 사전 준비가 끝났는지 여부</ko>
     * @param {boolean} [e.isReady] - Whether all elements are ready <ko>모든 엘리먼트가 준비가 끝났는지 여부</ko>
     * @param {boolean} [e.hasLoading] - Whether the loading attribute has been applied <ko>loading 속성이 적용되었는지 여부</ko>
     * @example
     * ```html
     * <div>
     *    <img src="./1.jpg" data-width="1280" data-height="853" style="width:100%"/>
     *    <img src="./2.jpg" data-width="1280" data-height="853"/>
     *    <img src="ERR" data-width="1280" data-height="853"/>
     * </div>
     * ```
     * ## Javascript
     * ```js
     * import ImReady from "@egjs/imready";
     *
     * const im = new ImReady(); // umd: eg.ImReady
     * im.check(document.querySelectorAll("img")).on({
     *   preReadyElement: e => {
     *     // 1, 3
     *     // 2, 3
     *     // 3, 3
     *     console.log(e.preReadyCount, e.totalCount),
     *   },
     * });
     * ```
     */
    this.trigger("preReadyElement", {
      element: info.element,
      index,

      preReadyCount: this.preReadyCount,
      readyCount: this.readyCount,
      totalCount: this.totalCount,

      isPreReady: this.isPreReady(),
      isReady: this.isReady(),
      hasLoading: info.hasLoading,
    });
  }
  private onPreReady() {
    this.isPreReadyOver = true;
    /**
     * An event occurs when all element are pre-ready (When all elements have the loading attribute applied or the size is known)
     * @ko 모든 엘리먼트들이 사전 준비된 경우 (모든 엘리먼트들이 loading 속성이 적용되었거나 사이즈를 알 수 있는 경우) 이벤트가 발생한다.
     * @event eg.ImReady#preReady
     * @param {eg.ImReady.OnPreReady} e - The object of data to be sent to an event <ko>이벤트에 전달되는 데이터 객체</ko>
     * @param {number} [e.readyCount] - Number of elements ready <ko>준비된 엘리먼트들의 개수</ko>
     * @param {number} [e.totalCount] - Total number of elements <ko>엘리먼트들의 총 개수</ko>
     * @param {boolean} [e.isReady] - Whether all elements are ready <ko>모든 엘리먼트가 준비가 끝났는지 여부</ko>
     * @param {boolean} [e.hasLoading] - Whether the loading attribute has been applied <ko>loading 속성이 적용되었는지 여부</ko>
     * @example
     * ```html
     * <div>
     *    <img src="./1.jpg" data-width="1280" data-height="853" style="width:100%"/>
     *    <img src="./2.jpg" data-width="1280" data-height="853"/>
     *    <img src="ERR" data-width="1280" data-height="853"/>
     * </div>
     * ```
     * ## Javascript
     * ```js
     * import ImReady from "@egjs/imready";
     *
     * const im = new ImReady(); // umd: eg.ImReady
     * im.check(document.querySelectorAll("img")).on({
     *   preReady: e => {
     *     // 0, 3
     *     console.log(e.readyCount, e.totalCount),
     *   },
     * });
     * ```
     */
    this.trigger("preReady", {
      readyCount: this.readyCount,
      totalCount: this.totalCount,
      isReady: this.isReady(),
      hasLoading: this.hasLoading(),
    });
  }
  private onReadyElement(index: number) {
    const info = this.elementInfos[index];
    /**
     * An event occurs when the element is ready
     * @ko 해당 엘리먼트가 준비가 되었을 때 이벤트가 발생한다.
     * @event eg.ImReady#readyElement
     * @param {eg.ImReady.OnReadyElement} e - The object of data to be sent to an event <ko>이벤트에 전달되는 데이터 객체</ko>
     * @param {HTMLElement} [e.element] - The ready element.<ko>준비된 엘리먼트</ko>
     * @param {number} [e.index] - The index of the ready element. <ko>준비된 엘리먼트의 인덱스</ko>
     * @param {boolean} [e.hasError] - Whether there is an error in the element <ko>해당 엘리먼트에 에러가 있는지 여부</ko>
     * @param {number} [e.errorCount] - The number of elements with errors <ko>에러가 있는 엘리먼트들의 개수</ko>
     * @param {number} [e.totalErrorCount] - The total number of targets with errors <ko>에러가 있는 타겟들의 총 개수</ko>
     * @param {number} [e.preReadyCount] - Number of elements pre-ready <ko>사전 준비된 엘리먼트들의 개수</ko>
     * @param {number} [e.readyCount] - Number of elements ready <ko>준비된 엘리먼트들의 개수</ko>
     * @param {number} [e.totalCount] - Total number of elements <ko>엘리먼트들의 총 개수</ko>
     * @param {boolean} [e.isPreReady] - Whether all elements are pre-ready <ko>모든 엘리먼트가 사전 준비가 끝났는지 여부</ko>
     * @param {boolean} [e.isReady] - Whether all elements are ready <ko>모든 엘리먼트가 준비가 끝났는지 여부</ko>
     * @param {boolean} [e.hasLoading] - Whether the loading attribute has been applied <ko>loading 속성이 적용되었는지 여부</ko>
     * @param {boolean} [e.isPreReadyOver] - Whether pre-ready is over <ko>사전 준비가 끝났는지 여부</ko>
     * @example
     * ```html
     * <div>
     *    <img src="./1.jpg" data-width="1280" data-height="853" style="width:100%"/>
     *    <img src="./2.jpg" data-width="1280" data-height="853"/>
     *    <img src="ERR" data-width="1280" data-height="853"/>
     * </div>
     * ```
     * ## Javascript
     * ```js
     * import ImReady from "@egjs/imready";
     *
     * const im = new ImReady(); // umd: eg.ImReady
     * im.check(document.querySelectorAll("img")).on({
     *   readyElement: e => {
     *     // 1, 0, false, 3
     *     // 2, 1, false, 3
     *     // 3, 2, true, 3
     *     console.log(e.readyCount, e.index, e.hasError, e.totalCount),
     *   },
     * });
     * ```
     */
    this.trigger("readyElement", {
      index,
      element: info.element,

      hasError: info.hasError,
      errorCount: this.getErrorCount(),
      totalErrorCount: this.totalErrorCount,

      preReadyCount: this.preReadyCount,
      readyCount: this.readyCount,
      totalCount: this.totalCount,

      isPreReady: this.isPreReady(),
      isReady: this.isReady(),

      hasLoading: info.hasLoading,
      isPreReadyOver: this.isPreReadyOver,
    });
  }
  private onReady() {
    /**
     * An event occurs when all element are ready
     * @ko 모든 엘리먼트들이 준비된 경우 이벤트가 발생한다.
     * @event eg.ImReady#ready
     * @param {eg.ImReady.OnReady} e - The object of data to be sent to an event <ko>이벤트에 전달되는 데이터 객체</ko>
     * @param {number} [e.errorCount] - The number of elements with errors <ko>에러가 있는 엘리먼트들의 개수</ko>
     * @param {number} [e.totalErrorCount] - The total number of targets with errors <ko>에러가 있는 타겟들의 총 개수</ko>
     * @param {number} [e.totalCount] - Total number of elements <ko>엘리먼트들의 총 개수</ko>
     * @example
     * ```html
     * <div>
     *    <img src="./1.jpg" data-width="1280" data-height="853" style="width:100%"/>
     *    <img src="./2.jpg" data-width="1280" data-height="853"/>
     *    <img src="ERR" data-width="1280" data-height="853"/>
     * </div>
     * ```
     * ## Javascript
     * ```js
     * import ImReady from "@egjs/imready";
     *
     * const im = new ImReady(); // umd: eg.ImReady
     * im.check(document.querySelectorAll("img")).on({
     *   preReady: e => {
     *     // 0, 3
     *     console.log(e.readyCount, e.totalCount),
     *   },
     *   ready: e => {
     *     // 1, 3
     *     console.log(e.errorCount, e.totalCount),
     *   },
     * });
     * ```
     */
    this.trigger("ready", {
      errorCount: this.getErrorCount(),
      totalErrorCount: this.totalErrorCount,
      totalCount: this.totalCount,
    });
  }
  private getErrorCount() {
    return this.elementInfos.filter(info => info.hasError).length;
  }
  private hasLoading() {
    return this.elementInfos.some(info => info.hasLoading);
  }
}

export default ImReadyManager;
