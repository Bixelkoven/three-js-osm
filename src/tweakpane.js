import { Pane } from 'tweakpane';

export function initTweakpane(scene, camera, renderer, controls, ambiLight, hemiLight, sunLight, initBuildings){
    const pane = new Pane();

    const ambi = pane.addFolder({
        title: 'ambiLight',
        expanded: false,
    });
    const hemi = pane.addFolder({
        title: 'hemiLight',
        expanded: false,
    });
    const sun = pane.addFolder({
        title: 'sunLight',
        expanded: false,
    });
    const sunSh = pane.addFolder({
        title: 'sunLight.shadow',
        expanded: false,
    });
    const sunShMap = pane.addFolder({
        title: 'sunLight.shadow.mapSize',
        expanded: false,
    });
    // const sunShC = pane.addFolder({
    //     title: 'sunLight.shadow.camera',
    //     expanded: false,
    // });
    ambi.addBinding(ambiLight, 'intensity');
    ambi.addBinding(ambiLight, 'color');
    hemi.addBinding(hemiLight, 'intensity');
    hemi.addBinding(hemiLight, 'color');
    sun.addBinding(sunLight, 'castShadow');
    sun.addBinding(sunLight, 'intensity');
    sun.addBinding(sunLight, 'color');
    sun.addBinding(sunLight, 'position');
    sunSh.addBinding(sunLight.shadow, 'bias');
    sunShMap.addBinding(sunLight.shadow.mapSize, 'width', {
        min: 512,
        max: 16384
    });
    sunShMap.addBinding(sunLight.shadow.mapSize, 'height', {
        min: 512,
        max: 16384
    });

    const controlsFolder = pane.addFolder({
        title: 'controls',
        expanded: false,
    });
    const cameraFolder = pane.addFolder({
        title: 'camera',
        expanded: false,
    });
    controlsFolder.addBinding(controls, 'enabled');
    controlsFolder.addBinding(controls, 'enableDamping');
    controlsFolder.addBinding(controls, 'dampingFactor');
    controlsFolder.addBinding(controls, 'autoRotate');
    controlsFolder.addBinding(controls, 'enablePan');
    controlsFolder.addBinding(controls, 'enableRotate');
    controlsFolder.addBinding(controls, 'enableZoom');
    controlsFolder.addBinding(controls, 'panSpeed');
    controlsFolder.addBinding(controls, 'rotateSpeed');
    controlsFolder.addBinding(controls, 'zoomSpeed');
    cameraFolder.addBinding(camera, 'fov', { min: 0, max: 200, step: 1 })
    .on('change', (ev) => {
        camera.fov = ev.value;
        camera.updateProjectionMatrix();
    });
    cameraFolder.addBinding(camera, 'aspect');
    cameraFolder.addBinding(camera, 'near');
    cameraFolder.addBinding(camera, 'far');
    cameraFolder.addBinding(camera, 'coordinateSystem');
    cameraFolder.addBinding(camera, 'focus');   
    cameraFolder.addBinding(camera, 'position');
    cameraFolder.addBinding(camera, 'rotation');
    cameraFolder.addBinding(camera, 'scale');
    cameraFolder.addBinding(camera, 'up', {
        min: -0.10,
        max: 0.10,
        step: 0.10
    });
    return pane;
}