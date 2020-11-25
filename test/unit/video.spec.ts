import { sandbox, cleanup, waitEvent, waitFor, getSize } from "./utils";
import ImReady from "../../src/index";
import { spy } from "sinon";
import { toArray, innerWidth, innerHeight } from "../../src/utils";

declare const viewport: any;

describe("Test video", () => {
  document.body.style.overflow = "hidden";
  let el: HTMLElement;
  let im: ImReady;

  beforeEach(() => {
    document.body.style.overflow = "visible";
    im = new ImReady();
    el = sandbox("");
    el.style.overflow = "hidden";
  });
  afterEach(() => {
    im.destroy();
    cleanup();
  });
  it("should check there are videos", async () => {
    // Given
    el.innerHTML = `
      <video src="./videos/pano1.mp4" ></video>
      <video src="./videos/pano2.mp4" ></video>
    `;
    const readySpy = spy();
    im.on("ready", readySpy);

    // When
    im.check([el]);
    await waitEvent(im, "ready");

    // Then
    expect(readySpy.calledOnce).to.be.true;
    expect(readySpy.args[0][0].totalCount).to.be.equals(1);
    expect(readySpy.args[0][0].errorCount).to.be.equals(0);
    expect(im.getTotalCount()).to.be.equals(1);
  });
  it("should check that the element(video) is loaded.", async () => {
    // Given
    el.innerHTML = `
      <video src="./videos/pano3.mp4" ></video>
    `;
    // When
    const video = el.querySelector("video");
    im.check([video]);
    const readySpy = spy();
    // default size 300 x 150
    const height1 = innerHeight(video);

    im.on("ready", readySpy);
    await waitEvent(im, "ready");

    // Then
    const height2 = innerHeight(video);
    expect(height1).to.be.equals(150);
    expect(height2).to.be.not.equals(150);
    expect(readySpy.calledOnce).to.be.true;
  });

  it("should check that error event occurs when there are error videos", async () => {
    // Given
    el.innerHTML = `
    <video src="./videos/pano4.mp4" ></video>
    <video src="./videos/ERR.mp4" ></video>
    `;
    const readySpy = spy();
    const errorSpy = spy();

    im.on("ready", readySpy);
    im.on("error", errorSpy);

    // When
    im.check([el]);

    await waitEvent(im, "ready");

    const e = errorSpy.args[0][0];

    // Then
    expect(errorSpy.calledOnce).to.be.true;
    expect(readySpy.calledOnce).to.be.true;

    expect(e.index).to.be.equals(0);
    expect(e.element.tagName).to.be.equals("DIV");
    expect(e.target.getAttribute("src")).to.have.string("ERR");
  });

  it("should check that error event occurs when there are error videos (cache)", async () => {
    // Given
    el.innerHTML = `
    <video src="./videos/pano5.mp4" ></video>
    <video src="./videos/ERR2.mp4" ></video>
    `;
    const readySpy = spy();
    const errorSpy = spy();
    im.on("ready", readySpy);
    im.on("error", errorSpy);
    // When

    im.check([el]);

    await waitEvent(im, "ready");

    im.check([el]);

    await waitEvent(im, "ready");
    // Then
    expect(errorSpy.callCount).to.be.equals(2);
    expect(readySpy.callCount).to.be.equals(2);

    for (let i = 0; i < 2; ++i) {
      const e = errorSpy.args[i][0];

      expect(e.index).to.be.equals(0);
      expect(e.element.tagName).to.be.equals("DIV");
      expect(e.target.getAttribute("src")).to.have.string("ERR");
    }
  });
  it("should check that preReady caculate virtual sizes when there are data prefixes", async () => {
    // Given
    el.innerHTML = `
      <video src="./videos/pano6.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
      <video src="./videos/pano7.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
      <video src="./videos/pano8.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
    `;
    // When
    im.check([el]);

    const video = el.querySelectorAll("video");
    await waitEvent(im, "preReady");
    const fakeSizes = toArray(video).map(video => {
      return getSize(video);
    });
    await waitEvent(im, "ready");
    const realSizes = toArray(video).map(video => {
      return getSize(video);
    });

    // Then
    fakeSizes.forEach(size => {
      expect(size[0]).to.be.equals(size[1]);
    });
    realSizes.forEach(size => {
      expect(size[0]).to.be.not.equals(size[1]);
    });
  });
  it("should check that AutoSizer works when the element itself has data prefixes", async () => {
    // Given
    el.setAttribute("data-width", "100");
    el.setAttribute("data-height", "100");
    el.innerHTML = `
    <video src="./videos/pano9.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
    <video src="./videos/pano10.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
    <video src="./videos/pano11.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
    `;
    // When
    im.check([el]);

    await waitEvent(im, "preReady");
    // 100 x 100
    const size1 = getSize(el);

    await waitEvent(im, "ready");
    // ? X ?
    const size2 = getSize(el);


    // Then
    expect(size1[0]).to.be.equals(size1[1]);
    expect(size2[0]).to.be.not.equals(size2[1]);
  });
  it("should check that ignored when the property include a skip attribute.", async () => {
    // Given
    el.innerHTML = `
    <video src="./videos/pano12.mp4" data-skip="true" data-width="100" data-height="100" style="width: 100%;"></video>
    <video src="./videos/pano13.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
    <video src="./videos/pano14.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
    `;
    const readyElementSpy = spy();
    const readySpy = spy();
    im.on("readyElement", readyElementSpy);
    im.on("ready", readySpy);

    // When
    im.check(el.querySelectorAll("video"));

    await waitEvent(im, "ready");

    // Then
    expect(readyElementSpy.callCount).to.be.equals(2);
    expect(readySpy.args[0][0].totalCount).to.be.equals(2);
    expect(im.getTotalCount()).to.be.equals(2);
  });
  it("should check that AutoSizer works when window resize (400 => 600)", async () => {
    // Given
    el.innerHTML = `
    <video src="./videos/pano15.mp4" data-width="100" data-height="100" style="width: 100%;"></video>
  `;

    // When
    im.check([el]);

    const video = el.querySelector("video");

    // maybe 400 x 400
    const size1 = getSize(video);

    viewport.set(600, 400);
    // When the network state is too early, an finish event occurs in an instant.
    await waitFor(60);

    // maybe 600 x 600
    const size2 = getSize(video);

    await waitEvent(im, "ready");

    // maybe 600 X ???
    const size3 = getSize(video);

    // Then
    // preReady (ratio 1:1)
    expect(size1[0]).to.be.equals(size1[1]);

    // resize 400 => 600
    expect(size2[0]).to.be.equals(size2[1]);
    expect(size1[1]).to.be.not.equals(size2[1]);

    // ready
    expect(size2[0]).to.be.equals(size3[0]);
    expect(size2[1]).to.be.not.equals(size3[1]);
  });
  it("should check that AutoSizer works when data-fixed='height' and window height (400 => 600)", async () => {
    // Given
    el.style.position = "absolute";
    el.style.width = "100%";
    el.style.height = "100%";
    el.innerHTML = `
    <video src="./videos/pano16.mp4" data-fixed="height" data-width="100" data-height="100" style="height: 100%;"></video>
    `;
    // When
    im.check([el]);
    const video = el.querySelector("video");

    // window size 300
    const width1 = innerWidth(video);
    const height1 = innerHeight(video);

    viewport.set(400, 600);
    // When the network state is too early, an finish event occurs in an instant.
    await waitFor(60);
    // window size 600
    const width2 = innerWidth(video);
    const height2 = innerHeight(video);

    await waitEvent(im, "ready");

    // window size 600
    const width3 = innerWidth(video);
    const height3 = innerHeight(video);

    // Then
    // preReady (ratio 1:1)
    expect(width1).to.be.equals(height1);

    // resize
    expect(width2).to.be.equals(height2);
    expect(width1).to.be.not.equals(width2);

    // ready
    expect(height2).to.be.equals(height3);
    expect(width2).to.be.not.equals(width3);
  });
});
