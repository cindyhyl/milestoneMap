'use strict'

var MsAtReport = function (obj, index, mMap) {
    // state
    this.milestone;
    this.report;
    this.comment;
    this.status;
    this.date;

    //view
    this.elem = Draw.svgElem("g", {
        "class": "msAtReport"
    });
    this.elemLine = Draw.svgElem ("g", {
        "class": "businessMsLine"
    });
    this.x;
    
    // used to prevent click event accumulation
    this.g;
    this.diamond;

    // view model
    this.dependencies = [];
    this.dependents = [];
    this.index = index;
    this.mMap = mMap;

    this.restore (obj);
};
// static methods/properties
MsAtReport.COMPLETE = 0;
MsAtReport.ONTRACK = 1;
MsAtReport.ATRISK = 2;
MsAtReport.LATE = 3;
MsAtReport.PREVIOUS = 4;

MsAtReport.DIAMONDSIZE = 7;

MsAtReport.prototype.restore = function (obj) {
    if (this.milestone) {
        this.milestone.removeReport (this);
    }
    
    this.milestone = this.mMap.milestones[obj.milestone];
    this.milestone.addReport(this);
    
    this.report = this.mMap.reports[obj.report];
    this.comment = obj.comment;
    this.status = obj.status;
    this.date = obj.date;
};
MsAtReport.prototype.save = function () {
    assert (() => this.mMap.reports[this.report.index] === this.report);
    assert (() => this.mMap.milestones[this.milestone.index] ===
            this.milestone);
    return {
        milestone: this.milestone.index,
        report: this.report.index,
        comment: this.comment,
        status: this.status,
        date: this.date
    };
};

MsAtReport.prototype.draw = function () {
    this.elem.innerHTML = "";
    
    if (this.report !== this.mMap.currReport &&
        this.report !== this.mMap.cmpReport)
    {
        return;
    }

    this.x = this.mMap.getXCoord (this.date);
    this.elem.setAttribute("transform", "translate(" + this.x + " 0)");

    this.g = Draw.svgElem("g", {}, this.elem);

    if (this.report === this.mMap.currReport) {
        this.milestone.currX = this.x;
        this.drawCurrent();
    }   
    else if (this.report === this.mMap.cmpReport){
        this.milestone.cmpX = this.x;
    }

    this.diamond = Draw.svgElem("path", {
        "class": this.resolveStatusClass (),
        "d" : "M -" +  MsAtReport.DIAMONDSIZE + " 0" +
            "L 0 " +  MsAtReport.DIAMONDSIZE +
            "L " + MsAtReport.DIAMONDSIZE + " 0" +
            "L 0 -" + MsAtReport.DIAMONDSIZE + " Z"
    }, this.g);
    this.diamond.addEventListener ("click", this.diamondOnClick.bind(this));
};
MsAtReport.prototype.drawLine = function () {
    this.elemLine.innerHTML = "";
    
    if (!this.isCurrent() || !this.isBusinessMs()) {
        return this.elemLine;
    }

    Draw.svgElem("line", {
        "x1": this.x, "y1": 0,
        "x2": this.x, "y2": Draw.getElemHeight(this.mMap.elem)
    }, this.elemLine);

    return this.elemLine;
}

MsAtReport.prototype.resolveStatusClass = function () {
    if (this.isCurrent()) {
        switch (this.status) {
        case MsAtReport.COMPLETE:
            return "complete";
        case MsAtReport.ONTRACK:
            return "on-track";
        case MsAtReport.ATRISK:
            return "at-risk";
        case MsAtReport.LATE:
            return "late";
        }
    }
    else if (this.mMap.cmpReport === this.report){
        return "previous";
    }
    assert (() => false);
};
MsAtReport.prototype.isCurrent = function () {
    return this.mMap.currReport === this.report;
};
MsAtReport.prototype.isBusinessMs = function () {
    return this.milestone.project.index === -1;
};

MsAtReport.prototype.updateDiamond = function (cls) {
    this.diamond.setAttribute("class", this.resolveStatusClass());
};

MsAtReport.prototype.drawCurrent = function () {
    var comment = new Draw.svgTextInput (
        this.comment, Draw.ALIGNCENTER, this.mMap.unclicker,
        this.modifyComment.bind(this), {
            "transform": "translate(0, 20)",
            "class": "msComment"
        }, this.g, "\xA0"); // nbsp allows comment field to actually appear
    
    var nameDate = new MilestoneTD (
        this.milestone.name, this.date, this.mMap.unclicker,
        this.milestone.modifyName.bind(this.milestone),
        this.modifyDate.bind(this), {
            "transform": "translate(0, -10)",
            "class": "milestoneData"
        }, this.g)
    
    Draw.menu (Draw.ALIGNCENTER, this.mMap.unclicker, [{
        "icon": "icons/health.svg",
        "action": this.cycleStatus.bind(this)
    },{
        "icon": "icons/delete.svg",
        "action": this.deleteDraw.bind(this)
    },{
        "icon": "icons/arrow-right.svg",
        "action": this.createDependency.bind(this)
    }], {
        "transform": "translate(0, -50)"
    }, this.g);

    // TODO put other text here
};

// linking
MsAtReport.prototype.addDependency = function (dependency) {
    assert (() => dependency instanceof Dependency);
    this.dependencies.push(dependency);
};
MsAtReport.prototype.removeDependency = function (dependency) {
    this.dependencies = this.dependencies.filter(elem => elem !== dependency);
};
MsAtReport.prototype.addDependent = function (dependent) {
    assert (() => dependent instanceof Dependency);
    this.dependents.push(dependent);
};
MsAtReport.prototype.removeDependent = function (dependent) {
    this.dependents = this.dependents.filter(elem => elem !== dependent);
};

// events
MsAtReport.prototype.diamondOnClick = function () {
    if (this.mMap.globalMode === MilestoneMap.CREATEDEPENDENCY) {
        var dep = this.mMap.addDependency ({
            "report": this.mMap.currReport.index,
            "dependency": this.mMap.globalData,
            "dependent": this.milestone.index
        });
        dep.draw();
    };
};

// modifications
MsAtReport.prototype.deleteThis = function () {    
    this.milestone.removeReport (this);
    this.dependencies.forEach(dependency => dependency.deleteDraw());
    this.dependents.forEach(dependent => dependent.deleteDraw());
    this.mMap.removeMsAtReport (this);
};


// user modifications
MsAtReport.prototype.modifyDate = function (e, input) {
    var date = input.date;

    this.date = this.mMap.clampDate (date);

    this.draw();
    this.drawLine();
    this.milestone.draw();
    this.dependencies.forEach(dep => dep.draw());
    this.dependents.forEach(dep => dep.draw());
};
MsAtReport.prototype.modifyComment = function (e, input) {
    this.comment = input.text;
};
MsAtReport.prototype.cycleStatus = function () {
    this.status = this.status >= MsAtReport.LATE ? 0 : this.status + 1;
    this.updateDiamond();
};
MsAtReport.prototype.deleteDraw = function () {
    this.deleteThis ();

    if (this.milestone.atReports.length === 0) {
        this.milestone.deleteDraw ();
    }
    else {
        this.milestone.draw();
    }
};
MsAtReport.prototype.createDependency = function () {
    this.mMap.globalMode = MilestoneMap.CREATEDEPENDENCY;
    this.mMap.globalData = this.milestone.index;
    this.mMap.globalModeSet = true;
};
